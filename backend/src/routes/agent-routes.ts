// src/routes/Agent-routes.ts
import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { processAgentMetrics } from '../services/agent-metrics-service';
import { insertServerMetricHistory } from '../services/history-service';
import { upsertAssetProfileFromSource } from '../services/asset-profile-service';

function generateAssetKey(type: string): string {
  const prefix = type === 'collector' ? 'INNER-COL' : 'INNER-SRV';
  const random = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `${prefix}-${random}`;
}

export default async function agentRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;

  // 1. Enrollment de Agente ou Coletor
  fastify.post('/enroll', async (request, reply) => {
    const body = request.body as any;
    const { activation_token, agent_type = 'endpoint', hostname, ip_address, os_info, version = '1.0.0', metadata = {} } = body || {};

    if (!activation_token || !hostname) {
      return reply.code(400).send({ error: 'Token de ativação e Hostname são obrigatórios.' });
    }

    // Validar Token de Ativação
    const { data: tokenRecord, error: tokenErr } = await supabaseAdmin
      .from('agent_activation_tokens')
      .select('*')
      .eq('token', activation_token.trim())
      .eq('is_active', true)
      .single();

    if (tokenErr || !tokenRecord) {
      return reply.code(401).send({ error: 'Token de ativação inválido ou inativo.' });
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return reply.code(401).send({ error: 'Token de ativação expirado.' });
    }

    const company_id = tokenRecord.company_id;
    const asset_key = generateAssetKey(agent_type);
    const agent_secret = crypto.randomBytes(24).toString('hex');

    // Registrar Agente
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('registered_agents')
      .insert({
        company_id,
        agent_type,
        asset_key,
        agent_secret,
        hostname,
        ip_address,
        os_info,
        version,
        status: 'Online',
        last_heartbeat: new Date().toISOString(),
        metadata,
      })
      .select()
      .single();

    if (agentErr || !agent) {
      return reply.code(500).send({ error: 'Falha ao registrar agente: ' + agentErr?.message });
    }

    // Se for Agente de Máquina (endpoint), criar/atualizar tabela de servidores
    if (agent_type === 'endpoint') {
      const { data: server, error: srvErr } = await supabaseAdmin
        .from('servers')
        .upsert(
          {
            company_id,
            hostname,
            status: 'Online',
            monitoring_source: 'agent_native',
            asset_key,
            agent_id: agent.id,
            last_updated: new Date().toISOString(),
          },
          { onConflict: 'company_id,hostname' }
        )
        .select()
        .single();

      if (server && !srvErr) {
        // Criar asset_profile com visibilidade para o cliente
        await supabaseAdmin
          .from('asset_profiles')
          .upsert({
            company_id,
            source_type: 'server',
            source_id: server.id,
            customer_visible: true,
            include_in_health_score: true,
            display_name: hostname,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'company_id,source_type,source_id' });
      }
    }

    return reply.send({
      status: 'success',
      message: 'Agente registrado com sucesso.',
      asset_key,
      agent_secret,
      agent_id: agent.id,
      company_id,
    });
  });

  // 2. Recebimento de Métricas de Agente de Máquina (Endpoint) — Legado
  fastify.post('/metrics', async (request, reply) => {
    const agentSecret = (request.headers['x-agent-secret'] as string) || (request.headers['authorization'] as string)?.replace('Bearer ', '');
    const body = request.body as any;
    const { asset_key, cpu_usage = 0, memory_usage = 0, memory_total = 0, disk_usage = 0, disk_total = 0, status = 'Online' } = body || {};

    if (!agentSecret || !asset_key) {
      return reply.code(400).send({ error: 'Chave do agente e segredo são obrigatórios.' });
    }

    // Validar Agente Registrado
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', asset_key)
      .eq('agent_secret', agentSecret)
      .single();

    if (agentErr || !agent) {
      return reply.code(401).send({ error: 'Autenticação do agente falhou.' });
    }

    const now = new Date().toISOString();

    // Atualizar heartbeat do agente
    await supabaseAdmin
      .from('registered_agents')
      .update({ status, last_heartbeat: now, updated_at: now })
      .eq('id', agent.id);

    // Atualizar tabela servers
    const { data: server } = await supabaseAdmin
      .from('servers')
      .upsert(
        {
          company_id: agent.company_id,
          hostname: agent.hostname,
          cpu_usage: Number(cpu_usage),
          memory_usage: Number(memory_usage),
          memory_total: Number(memory_total),
          disk_usage: Number(disk_usage),
          disk_total: Number(disk_total),
          status,
          monitoring_source: 'agent_native',
          asset_key: agent.asset_key,
          agent_id: agent.id,
          last_updated: now,
        },
        { onConflict: 'company_id,hostname' }
      )
      .select()
      .single();

    if (server) {
      // Gravar Histórico de Métricas
      await insertServerMetricHistory(supabaseAdmin, [{
        company_id: agent.company_id,
        hostname: agent.hostname,
        cpu_usage: Number(cpu_usage),
        memory_usage: Number(memory_usage),
        memory_total: Number(memory_total),
        disk_usage: Number(disk_usage),
        disk_total: Number(disk_total),
        status,
      }]);

      // Atualizar Inventário de Ativos
      await upsertAssetProfileFromSource(
        supabaseAdmin,
        'server',
        server,
        {
          hostname: agent.hostname,
          cpu_usage: Number(cpu_usage),
          memory_usage: Number(memory_usage),
          disk_usage: Number(disk_usage),
          memory_total: Number(memory_total),
          disk_total: Number(disk_total),
          status,
          asset_key: agent.asset_key,
          monitoring_source: 'agent_native',
        }
      );
    }

    return reply.send({ status: 'success', timestamp: now });
  });

  // 2b. Recebimento de Métricas de Agente com Host + VMs (Novo formato)
  fastify.post('/metrics/v2', async (request, reply) => {
    const agentSecret = (request.headers['x-agent-secret'] as string) || (request.headers['authorization'] as string)?.replace('Bearer ', '');
    const body = request.body as any;

    const {
      asset_key,
      idempotency_key,
      collected_at,
      host,
      virtual_machines,
      partial = false,
      metadata = {},
    } = body || {};

    if (!agentSecret || !asset_key) {
      return reply.code(400).send({ error: 'Chave do agente e segredo são obrigatórios.' });
    }

    if (!host) {
      return reply.code(400).send({ error: 'Dados do host são obrigatórios.' });
    }

    // Validar Agente Registrado
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', asset_key)
      .eq('agent_secret', agentSecret)
      .single();

    if (agentErr || !agent) {
      return reply.code(401).send({ error: 'Autenticação do agente falhou.' });
    }

    // Processar métricas usando o service
    const result = await processAgentMetrics(supabaseAdmin, {
      agent_id: agent.id,
      company_id: agent.company_id,
      idempotency_key,
      collected_at: collected_at || new Date().toISOString(),
      host: {
        cpu_percent: host.cpu_percent || host.cpu_usage || 0,
        memory_percent: host.memory_percent || host.memory_usage || 0,
        memory_total_mb: host.memory_total_mb || host.memory_total || 0,
        memory_used_mb: host.memory_used_mb || host.memory_used || 0,
        disk_percent: host.disk_percent || host.disk_usage || 0,
        disk_total_gb: host.disk_total_gb || host.disk_total || 0,
        disk_used_gb: host.disk_used_gb || host.disk_used || 0,
        uptime_seconds: host.uptime_seconds,
      },
      virtual_machines: (virtual_machines || []).map((vm: any) => ({
        name: vm.name,
        cpu_percent: vm.cpu_percent,
        memory_percent: vm.memory_percent,
        memory_total_mb: vm.memory_total_mb,
        memory_used_mb: vm.memory_used_mb,
        disk_percent: vm.disk_percent,
        disk_total_gb: vm.disk_total_gb,
        disk_used_gb: vm.disk_used_gb,
        status: vm.status,
      })),
      partial,
      metadata,
    });

    if (!result.success) {
      return reply.code(500).send({ error: result.error });
    }

    return reply.send({
      status: 'success',
      timestamp: new Date().toISOString(),
      events_generated: result.events_count,
    });
  });

  // 3. Recebimento de Métricas do Coletor de Rede
  fastify.post('/collector/metrics', async (request, reply) => {
    const agentSecret = (request.headers['x-agent-secret'] as string) || (request.headers['authorization'] as string)?.replace('Bearer ', '');
    const body = request.body as any;
    const { asset_key, devices = [] } = body || {};

    if (!agentSecret || !asset_key) {
      return reply.code(400).send({ error: 'Chave do coletor e segredo são obrigatórios.' });
    }

    // Validar Coletor
    const { data: collector, error: colErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', asset_key)
      .eq('agent_secret', agentSecret)
      .eq('agent_type', 'collector')
      .single();

    if (colErr || !collector) {
      return reply.code(401).send({ error: 'Autenticação do coletor de rede falhou.' });
    }

    const now = new Date().toISOString();

    // Atualizar heartbeat do coletor
    await supabaseAdmin
      .from('registered_agents')
      .update({ status: 'Online', last_heartbeat: now, updated_at: now })
      .eq('id', collector.id);

    // Processar dispositivos de rede recebidos
    let count = 0;
    for (const dev of devices) {
      if (!dev.device_name) continue;

      const device_key = `INNER-NET-${crypto.createHash('md5').update(`${collector.company_id}-${dev.device_name}`).digest('hex').substring(0, 8).toUpperCase()}`;

      const { data: netDev } = await supabaseAdmin
        .from('network_devices')
        .upsert(
          {
            company_id: collector.company_id,
            device_name: dev.device_name,
            device_type: dev.device_type || 'Outro',
            location: dev.location || 'Rede Local',
            ip_address: dev.ip_address || '',
            uptime_percent: Number(dev.uptime_percent || 100),
            status: dev.status || 'Online',
            snmp_data: dev.snmp_data || {},
            monitoring_source: 'agent_native',
            asset_key: device_key,
            agent_id: collector.id,
            last_updated: now,
          },
          { onConflict: 'company_id,device_name' }
        )
        .select()
        .single();

      if (netDev) {
        await upsertAssetProfileFromSource(
          supabaseAdmin,
          'network_device',
          netDev,
          {
            device_name: dev.device_name,
            device_type: dev.device_type,
            ip_address: dev.ip_address,
            status: dev.status,
            snmp_data: dev.snmp_data,
            asset_key: device_key,
            monitoring_source: 'agent_native',
          }
        );
      }
      count++;
    }

    return reply.send({ status: 'success', processed: count, timestamp: now });
  });

  // 3a. Registro do Coletor de Rede (alias para /enroll com tipo collector)
  fastify.post('/collector/enroll', async (request, reply) => {
    const body = request.body as any;
    const { activation_token, hostname, ip_address, os_info, version = '1.0.0' } = body || {};

    if (!activation_token || !hostname) {
      return reply.code(400).send({ error: 'Token de ativacao e Hostname sao obrigatorios.' });
    }

    // Validar Token de Ativacao
    const { data: tokenRecord, error: tokenErr } = await supabaseAdmin
      .from('agent_activation_tokens')
      .select('*')
      .eq('token', activation_token.trim())
      .eq('is_active', true)
      .single();

    if (tokenErr || !tokenRecord) {
      return reply.code(401).send({ error: 'Token de ativacao invalido ou inativo.' });
    }

    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) {
      return reply.code(401).send({ error: 'Token de ativacao expirado.' });
    }

    const company_id = tokenRecord.company_id;
    const collector_id = generateAssetKey('collector');
    const collector_secret = crypto.randomBytes(24).toString('hex');

    // Registrar Coletor
    const { data: collector, error: colErr } = await supabaseAdmin
      .from('registered_agents')
      .insert({
        company_id,
        agent_type: 'collector',
        asset_key: collector_id,
        agent_secret: collector_secret,
        hostname,
        ip_address,
        os_info,
        version,
        status: 'Online',
        last_heartbeat: new Date().toISOString(),
      })
      .select()
      .single();

    if (colErr || !collector) {
      return reply.code(500).send({ error: 'Falha ao registrar coletor: ' + colErr?.message });
    }

    return reply.send({
      status: 'success',
      message: 'Coletor registrado com sucesso.',
      collector_id,
      collector_secret,
      agent_id: collector.id,
      company_id,
    });
  });

  // 3b. Envio de dispositivos do coletor
  fastify.post('/collector/devices', async (request, reply) => {
    const collectorSecret = request.headers['x-collector-secret'] as string;
    const body = request.body as any;
    const { collector_id, devices = [] } = body || {};

    if (!collectorSecret || !collector_id) {
      return reply.code(400).send({ error: 'ID e segredo do coletor sao obrigatorios.' });
    }

    // Validar Coletor - buscar pelo asset_key
    const { data: collector, error: colErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', collector_id)
      .eq('agent_secret', collectorSecret)
      .eq('agent_type', 'collector')
      .single();

    if (colErr || !collector) {
      return reply.code(401).send({ error: 'Autenticacao do coletor falhou.' });
    }

    const now = new Date().toISOString();

    // Atualizar heartbeat do coletor
    await supabaseAdmin
      .from('registered_agents')
      .update({ status: 'Online', last_heartbeat: now, updated_at: now })
      .eq('id', collector.id);

    // Processar dispositivos de rede recebidos
    let count = 0;
    for (const dev of devices) {
      if (!dev.ip_address) continue;

      const device_key = `INNER-NET-${crypto.createHash('md5').update(`${collector.company_id}-${dev.ip_address}`).digest('hex').substring(0, 8).toUpperCase()}`;

      const { data: netDev } = await supabaseAdmin
        .from('network_devices')
        .upsert(
          {
            company_id: collector.company_id,
            device_name: dev.device_name || `Device-${dev.ip_address}`,
            device_type: dev.device_type || 'Network Device',
            location: dev.location || 'Rede Local',
            ip_address: dev.ip_address,
            uptime_percent: Number(dev.uptime || 100),
            status: dev.status === 'Online' ? 'Online' : 'Offline',
            snmp_data: {
              sysdescr: dev.sysdescr || '',
              community: dev.community || 'public',
            },
            monitoring_source: 'agent_native',
            asset_key: device_key,
            agent_id: collector.id,
            last_updated: now,
          },
          { onConflict: 'company_id,ip_address' }
        )
        .select()
        .single();

      if (netDev) {
        // Criar asset_profile para o dispositivo
        await supabaseAdmin
          .from('asset_profiles')
          .upsert({
            company_id: collector.company_id,
            source_type: 'network_device',
            source_id: netDev.id,
            customer_visible: true,
            include_in_health_score: true,
            display_name: dev.device_name || `Device-${dev.ip_address}`,
            last_synced_at: now,
            updated_at: now,
          }, { onConflict: 'company_id,source_type,source_id' });
      }
      count++;
    }

    return reply.send({ status: 'success', processed: count, timestamp: now });
  });

  // 3c. Buscar configuracao de scan do coletor
  fastify.get<{ Params: { id: string } }>('/collector/:id/config', async (request, reply) => {
    const collectorSecret = request.headers['x-collector-secret'] as string;
    const { id } = request.params;

    if (!collectorSecret) {
      return reply.code(400).send({ error: 'Segredo do coletor e obrigatorio.' });
    }

    // Validar Coletor - buscar pelo asset_key
    const { data: collector, error: colErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', id)
      .eq('agent_secret', collectorSecret)
      .eq('agent_type', 'collector')
      .single();

    if (colErr || !collector) {
      return reply.code(401).send({ error: 'Autenticacao do coletor falhou.' });
    }

    // Buscar configuracao do coletor SNMP
    const { data: config, error: configErr } = await supabaseAdmin
      .from('snmp_collectors')
      .select('*')
      .eq('company_id', collector.company_id)
      .eq('enabled', true)
      .single();

    if (configErr || !config) {
      return reply.send({
        enabled: false,
        ip_range_start: null,
        ip_range_end: null,
        community_string: 'public',
      });
    }

    return reply.send({
      enabled: true,
      ip_range_start: config.ip_range_start,
      ip_range_end: config.ip_range_end,
      community_string: config.community_string || 'public',
      snmp_version: config.snmp_version || '2c',
      snmp_port: config.snmp_port || 161,
    });
  });

  // 4. Heartbeat explícito do agente
  fastify.post('/heartbeat', async (request, reply) => {
    const agentSecret = (request.headers['x-agent-secret'] as string) || (request.headers['authorization'] as string)?.replace('Bearer ', '');
    const body = request.body as any;
    const { asset_key, status = 'online', metrics_pending = false } = body || {};

    if (!agentSecret || !asset_key) {
      return reply.code(400).send({ error: 'Chave do agente e segredo são obrigatórios.' });
    }

    // Validar Agente Registrado
    const { data: agent, error: agentErr } = await supabaseAdmin
      .from('registered_agents')
      .select('*')
      .eq('asset_key', asset_key)
      .eq('agent_secret', agentSecret)
      .single();

    if (agentErr || !agent) {
      return reply.code(401).send({ error: 'Autenticação do agente falhou.' });
    }

    const now = new Date().toISOString();
    const agentStatus = status === 'online' ? 'Online' : 'Offline';

    await supabaseAdmin
      .from('registered_agents')
      .update({
        status: agentStatus,
        last_heartbeat: now,
        updated_at: now,
      })
      .eq('id', agent.id);

    return reply.send({
      status: 'success',
      acknowledged: true,
      timestamp: now,
      next_heartbeat_in_seconds: 300, // 5 minutos
    });
  });
}
