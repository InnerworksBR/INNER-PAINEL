// src/services/agent-metrics-service.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertMonitoringEvents } from './monitoring-events-service';

interface VirtualMachine {
  name: string;
  cpu_percent?: number;
  memory_percent?: number;
  memory_total_mb?: number;
  memory_used_mb?: number;
  disk_percent?: number;
  disk_total_gb?: number;
  disk_used_gb?: number;
  status?: string;
}

interface HostMetrics {
  cpu_percent: number;
  memory_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  disk_percent: number;
  disk_total_gb: number;
  disk_used_gb: number;
  uptime_seconds?: number;
}

interface AgentMetricsPayload {
  agent_id: string;
  company_id: string;
  idempotency_key?: string;
  collected_at: string;
  host: HostMetrics;
  virtual_machines?: VirtualMachine[];
  partial?: boolean;
  metadata?: Record<string, unknown>;
}

interface ServerRow {
  id: string;
  hostname: string;
  status: string;
  [key: string]: unknown;
}

/**
 * Processa métricas de agente e armazena:
 * 1. Grava em agent_metrics (histórico)
 * 2. Atualiza/atualiza servers com dados do host
 * 3. Cria/atualiza servidores para cada VM
 * 4. Gera eventos para mudanças de estado
 */
export async function processAgentMetrics(
  supabase: SupabaseClient,
  payload: AgentMetricsPayload
): Promise<{ success: boolean; error?: string; events_count: number }> {
  const { agent_id, company_id, idempotency_key, collected_at, host, virtual_machines = [], partial = false, metadata = {} } = payload;

  // 1. Verificar idempotency key (evitar duplicatas)
  if (idempotency_key) {
    const { data: existing } = await supabase
      .from('agent_metrics')
      .select('id')
      .eq('idempotency_key', idempotency_key)
      .single();

    if (existing) {
      return { success: true, error: 'Duplicate (idempotency_key)', events_count: 0 };
    }
  }

  // 2. Obter agente registrado para pegar hostname
  const { data: agent } = await supabase
    .from('registered_agents')
    .select('id, hostname, company_id')
    .eq('id', agent_id)
    .single();

  if (!agent) {
    return { success: false, error: 'Agent not found', events_count: 0 };
  }

  const hostname = agent.hostname;
  const now = new Date().toISOString();
  const collectedAt = new Date(collected_at).toISOString();

  // 3. Obter status anterior do host
  const { data: previousHost } = await supabase
    .from('servers')
    .select('id, status, cpu_usage, memory_usage')
    .eq('company_id', company_id)
    .eq('hostname', hostname)
    .single();

  // 4. Determinar status do host
  const hostStatus = determineHostStatus(host);
  const hostWarnings = collectHostWarnings(host, partial);

  // 5. Upsert servidor host
  const { data: hostServer, error: hostErr } = await supabase
    .from('servers')
    .upsert(
      {
        company_id,
        hostname,
        cpu_usage: Number(host.cpu_percent) || 0,
        memory_usage: Number(host.memory_percent) || 0,
        memory_total: Number(host.memory_total_mb) || 0,
        memory_used: Number(host.memory_used_mb) || 0,
        disk_usage: Number(host.disk_percent) || 0,
        disk_total: Number(host.disk_total_gb) || 0,
        disk_used: Number(host.disk_used_gb) || 0,
        status: hostStatus,
        is_virtual: false,
        monitoring_source: 'agent_native',
        agent_id,
        last_updated: now,
        zabbix_sync_warning: hostWarnings.length > 0 ? hostWarnings.join('; ') : null,
      },
      { onConflict: 'company_id,hostname' }
    )
    .select('id, status')
    .single();

  if (hostErr) {
    return { success: false, error: `Host upsert failed: ${hostErr.message}`, events_count: 0 };
  }

  // 6. Gravar métricas históricas
  const { error: metricsErr } = await supabase.from('agent_metrics').insert({
    agent_id,
    company_id,
    host_cpu_percent: Number(host.cpu_percent) || 0,
    host_memory_percent: Number(host.memory_percent) || 0,
    host_memory_total_mb: Number(host.memory_total_mb) || 0,
    host_memory_used_mb: Number(host.memory_used_mb) || 0,
    host_disk_percent: Number(host.disk_percent) || 0,
    host_disk_total_gb: Number(host.disk_total_gb) || 0,
    host_disk_used_gb: Number(host.disk_used_gb) || 0,
    host_uptime_seconds: Number(host.uptime_seconds) || 0,
    virtual_machines: virtual_machines || [],
    collected_at: collectedAt,
    received_at: now,
    partial,
    idempotency_key,
    metadata,
  });

  if (metricsErr) {
    console.error('Failed to insert agent_metrics:', metricsErr);
    // Não falhar por causa do histórico
  }

  // 7. Processar VMs
  const vmEvents: Array<{
    companyId: string;
    source: 'server';
    entityName: string;
    entityType: string;
    previousStatus?: string | null;
    currentStatus: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metadata?: Record<string, unknown>;
  }> = [];

  for (const vm of virtual_machines) {
    if (!vm.name) continue;

    const vmStatus = determineVmStatus(vm);

    // Buscar VM existente
    const { data: existingVm } = await supabase
      .from('servers')
      .select('id, status')
      .eq('company_id', company_id)
      .eq('hostname', vm.name)
      .single();

    // Upsert VM
    await supabase.from('servers').upsert(
      {
        company_id,
        hostname: vm.name,
        vm_parent_id: hostServer?.id || null,
        is_virtual: true,
        cpu_usage: Number(vm.cpu_percent) || 0,
        memory_usage: Number(vm.memory_percent) || 0,
        memory_total: Number(vm.memory_total_mb) || 0,
        memory_used: Number(vm.memory_used_mb) || 0,
        disk_usage: Number(vm.disk_percent) || 0,
        disk_total: Number(vm.disk_total_gb) || 0,
        disk_used: Number(vm.disk_used_gb) || 0,
        vm_cpu_percent: Number(vm.cpu_percent) || 0,
        vm_memory_percent: Number(vm.memory_percent) || 0,
        vm_memory_total_mb: Number(vm.memory_total_mb) || 0,
        vm_status: vm.status || vmStatus,
        status: vmStatus,
        monitoring_source: 'agent_native',
        agent_id,
        last_updated: now,
      },
      { onConflict: 'company_id,hostname' }
    );

    // Gerar evento se mudou de status
    const previousStatus = existingVm?.status;
    if (previousStatus && previousStatus !== vmStatus) {
      vmEvents.push({
        companyId: company_id,
        source: 'server',
        entityName: vm.name,
        entityType: 'VM',
        previousStatus,
        currentStatus: vmStatus,
        severity: vmStatus === 'Offline' ? 'critical' : vmStatus === 'Atencao' ? 'warning' : 'info',
        message: vmStatus === 'Offline'
          ? `VM ${vm.name} ficou offline.`
          : vmStatus === 'Atencao'
            ? `VM ${vm.name} está com coleta parcial.`
            : `VM ${vm.name} voltou ao normal.`,
        metadata: { parent_host: hostname, vm_status: vm.status },
      });
    }
  }

  // 8. Gerar eventos para host
  const events: Array<{
    companyId: string;
    source: 'server';
    entityName: string;
    entityType: string;
    previousStatus?: string | null;
    currentStatus: string;
    severity: 'info' | 'warning' | 'critical';
    message: string;
    metadata?: Record<string, unknown>;
  }> = [];

  if (previousHost && previousHost.status !== hostStatus) {
    events.push({
      companyId: company_id,
      source: 'server',
      entityName: hostname,
      entityType: 'Host',
      previousStatus: previousHost.status,
      currentStatus: hostStatus,
      severity: hostStatus === 'Offline' ? 'critical' : hostStatus === 'Atencao' ? 'warning' : 'info',
      message: hostStatus === 'Offline'
        ? `Host ${hostname} ficou offline.`
        : hostStatus === 'Atencao'
          ? `Host ${hostname} está com coleta parcial.`
          : `Host ${hostname} voltou ao normal.`,
      metadata: { cpu: host.cpu_percent, memory: host.memory_percent },
    });
  }

  // Combinar eventos
  const allEvents = [...events, ...vmEvents];

  if (allEvents.length > 0) {
    await insertMonitoringEvents(supabase, allEvents);
  }

  // 9. Atualizar heartbeat do agente
  await supabase
    .from('registered_agents')
    .update({
      status: 'Online',
      last_heartbeat: now,
      updated_at: now,
    })
    .eq('id', agent_id);

  return {
    success: true,
    events_count: allEvents.length,
  };
}

/**
 * Determina status do host baseado nas métricas
 */
function determineHostStatus(host: HostMetrics): string {
  // Se parcial, marcar como Atenção
  if (host.cpu_percent === 0 && host.memory_percent === 0 && host.disk_percent === 0) {
    return 'Atencao';
  }

  // CPU ou memória críticos
  if (host.cpu_percent > 90 || host.memory_percent > 90) {
    return 'Atencao';
  }

  return 'Online';
}

/**
 * Determina status da VM
 */
function determineVmStatus(vm: VirtualMachine): string {
  const status = vm.status?.toLowerCase();

  if (status === 'running' || status === 'ligado' || status === 'active') {
    if ((vm.cpu_percent && vm.cpu_percent > 90) || (vm.memory_percent && vm.memory_percent > 90)) {
      return 'Atencao';
    }
    return 'Online';
  }

  if (status === 'stopped' || status === 'off' || status === 'shut off' || status === 'desligada') {
    return 'Offline';
  }

  // Se não tem métricas, está com problema
  if (!vm.cpu_percent && !vm.memory_percent) {
    return 'Atencao';
  }

  return 'Online';
}

/**
 * Coleta avisos sobre problemas de coleta
 */
function collectHostWarnings(host: HostMetrics, partial: boolean): string[] {
  const warnings: string[] = [];

  if (partial) {
    warnings.push('Coleta parcial');
  }

  if (!host.cpu_percent && !partial) {
    warnings.push('CPU sem coleta');
  }

  if (!host.memory_percent && !host.memory_total_mb && !partial) {
    warnings.push('Memoria sem coleta');
  }

  if (!host.disk_percent && !partial) {
    warnings.push('Disco sem coleta');
  }

  return warnings;
}

/**
 * Atualiza status do agente para offline baseado em heartbeat
 */
export async function updateAgentOfflineStatus(
  supabase: SupabaseClient,
  companyId: string
): Promise<number> {
  const threshold = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 min

  // Encontrar agentes offline
  const { data: offlineAgents } = await supabase
    .from('registered_agents')
    .select('id, hostname, status')
    .eq('company_id', companyId)
    .eq('status', 'Online')
    .lt('last_heartbeat', threshold);

  if (!offlineAgents || offlineAgents.length === 0) {
    return 0;
  }

  // Atualizar status dos agentes
  await supabase
    .from('registered_agents')
    .update({ status: 'Offline', updated_at: new Date().toISOString() })
    .in('id', offlineAgents.map(a => a.id));

  // Atualizar servidores associados
  await supabase
    .from('servers')
    .update({ status: 'Offline', last_updated: new Date().toISOString() })
    .eq('company_id', companyId)
    .in('agent_id', offlineAgents.map(a => a.id));

  // Gerar eventos de offline
  const events = offlineAgents.map(agent => ({
    companyId,
    source: 'server' as const,
    entityName: agent.hostname,
    entityType: 'Host',
    previousStatus: 'Online',
    currentStatus: 'Offline',
    severity: 'warning' as const,
    message: `Host ${agent.hostname} está offline (sem heartbeat há mais de 10 min).`,
  }));

  if (events.length > 0) {
    await insertMonitoringEvents(supabase, events);
  }

  return offlineAgents.length;
}
