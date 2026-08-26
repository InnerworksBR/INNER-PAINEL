// src/services/glpi-service.ts
import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSyncError, recordSyncSuccess } from './integration-status-service';

export async function syncTickets(supabase: SupabaseClient, company_id: string): Promise<{ message: string; count: number }> {
  try {
    // 1. Buscar credenciais (centralizadas no .env)
    const apiUrl = process.env.GLPI_API_URL;
    const apiToken = process.env.GLPI_API_TOKEN;
    const userToken = process.env.GLPI_USER_TOKEN;

    if (!apiUrl || !apiToken || !userToken) {
      throw new Error('Credenciais globais do GLPI não configuradas no servidor (.env).');
    }

    // 2. Buscar ID da entidade do cliente
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('glpi_entity_id')
      .eq('company_id', company_id)
      .single();

    if (intError || !integrations || integrations.glpi_entity_id === null) {
      throw new Error('ID da Entidade do GLPI não configurado para esta empresa. Configure no menu Integrações.');
    }

    const entityId = integrations.glpi_entity_id;

    // 3. Iniciar sessão GLPI
    const initResponse = await axios.get(`${apiUrl}/initSession`, {
      headers: {
        'App-Token': apiToken,
        'Authorization': `user_token ${userToken}`,
      },
    });

    const sessionToken = initResponse.data.session_token;

    const glpiApi = axios.create({
      baseURL: apiUrl,
      headers: {
        'App-Token': apiToken,
        'Session-Token': sessionToken,
      },
    });

    // 4. Alterar entidade ativa para a do cliente (para buscar apenas os chamados dele)
    try {
      await glpiApi.post('/changeActiveEntities', {
        entities_id: String(entityId),
        is_recursive: false
      });
    } catch (e: any) {
       throw new Error(`Falha ao alterar Entidade no GLPI: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`);
    }

    // 2. Buscar tickets com paginação por range.
    // Estrategia final: usar /Ticket (NAO /search) com GET e range.
    // /search exige criteria[] obrigatorio na URL e quebra com URI too long.
    // /Ticket direto retorna a lista paginada via header Content-Range.
    const pageSize = 25;
    const maxTickets = 5000;
    const tickets: any[] = [];

    for (let start = 0; start < maxTickets; start += pageSize) {
      const end = start + pageSize - 1;
      const response = await glpiApi.get('/Ticket', {
        params: {
          range: `${start}-${end}`,
          order: 'DESC',
          sort: 'id',
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });

      const page = Array.isArray(response.data) ? response.data : [];
      tickets.push(...page);
      if (page.length < pageSize) break;
    }

    // 3. Mapear e persistir
    // A coluna glpi_date_mod foi adicionada na migration_014_glpi_date_mod.sql
    // mas pode não existir em ambientes que ainda não aplicaram a migration.
    // Para máxima compatibilidade, montamos o payload completo e, se o upsert
    // falhar especificamente por causa dessa coluna ausente, refazemos sem ela.
    const ticketsToUpsert = tickets.map((t: any) => ({
      glpi_id: t.id,
      title: t.name,
      status: mapGLPIStatus(t.status),
      sla_status: calculateSLA(t),
      priority: mapGLPIPriority(t.priority),
      requester: t.users_id_recipient_name || t.users_id_recipient || null,
      category: t.itilcategories_id_name || t.itilcategories_id || null,
      created_at: t.date_creation || t.date,
      glpi_date_mod: t.date_mod ? new Date(t.date_mod).toISOString() : null,
      company_id: company_id,
    }));

    // 4. Upsert no Supabase
    if (ticketsToUpsert.length > 0) {
      const { error } = await supabase
        .from('glpi_tickets')
        .upsert(ticketsToUpsert, { onConflict: 'company_id,glpi_id' });

      // Fallback: se a coluna glpi_date_mod não existir, refaz sem ela
      if (error && /glpi_date_mod.*schema cache|column.*glpi_date_mod/i.test(error.message || '')) {
        console.warn('[glpi-service] Coluna glpi_date_mod ausente — aplicando fallback sem ela. Aplique a migration_014_glpi_date_mod.sql no Supabase.');
        const ticketsFallback = ticketsToUpsert.map(({ glpi_date_mod, ...rest }) => rest);
        const { error: retryError } = await supabase
          .from('glpi_tickets')
          .upsert(ticketsFallback, { onConflict: 'company_id,glpi_id' });
        if (retryError) throw retryError;
      } else if (error) {
        throw error;
      }
    }

    // A tabela local deve refletir o retrato atual retornado pelo GLPI para a entidade,
    // não acumular chamados que já não pertencem mais ao conjunto sincronizado.
    const syncedGlpiIds = ticketsToUpsert.map((ticket) => ticket.glpi_id);
    let cleanupQuery = supabase.from('glpi_tickets').delete().eq('company_id', company_id);
    if (syncedGlpiIds.length > 0) {
      cleanupQuery = cleanupQuery.not('glpi_id', 'in', `(${syncedGlpiIds.join(',')})`);
    }
    const { error: cleanupError } = await cleanupQuery;
    if (cleanupError) throw cleanupError;

    // Encerrar sessão GLPI
    try {
      await glpiApi.get('/killSession');
    } catch (_) { /* ignore */ }

    await recordSyncSuccess(supabase, company_id, 'glpi', ticketsToUpsert.length);

    return {
      message: 'Sincronização GLPI concluída com sucesso',
      count: ticketsToUpsert.length,
    };
  } catch (error: any) {
    // Pegar detalhes do erro da API do GLPI, se existir
    const apiDetails = error.response?.data ? JSON.stringify(error.response.data) : '';
    console.error('Erro na sincronização do GLPI para a empresa', company_id, ':', error.message, apiDetails);
    await recordSyncError(supabase, company_id, 'glpi', `${error.message}${apiDetails ? ` ${apiDetails}` : ''}`);
    throw new Error(`Falha na sincronização GLPI: ${error.message}. Detalhes: ${apiDetails}`);
  }
}

function mapGLPIStatus(status: number | string): string {
  const statusMap: Record<string, string> = {
    '1': 'Novo',
    '2': 'Em Andamento (Atribuído)',
    '3': 'Em Andamento (Planejado)',
    '4': 'Pendente',
    '5': 'Resolvido',
    '6': 'Fechado',
  };
  return statusMap[String(status)] || String(status);
}

function mapGLPIPriority(priority: number | string): string {
  const priorityMap: Record<string, string> = {
    '1': 'Muito Baixa',
    '2': 'Baixa',
    '3': 'Média',
    '4': 'Alta',
    '5': 'Muito Alta',
    '6': 'Maior',
  };
  return priorityMap[String(priority)] || String(priority);
}

function calculateSLA(t: any): string {
  // 1. Se o GLPI retorna o estado do SLA explicitamente, usa ele
  if (t.sla_ttr_state !== undefined && t.sla_ttr_state !== null && t.sla_ttr_state !== '') {
    return String(t.sla_ttr_state) === '1' ? 'Fora do SLA' : 'Dentro do SLA';
  }

  // 2. Se tem time_to_resolve, calcula baseado em resolvedate ou now
  if (t.time_to_resolve && t.time_to_resolve !== 'null' && t.time_to_resolve !== '0000-00-00 00:00:00') {
    const limitDate = new Date(t.time_to_resolve);
    if (!isNaN(limitDate.getTime())) {
      // Se resolvido/fechado (status 5 ou 6), compara com solvedate
      if (['5', '6', 'Resolvido', 'Fechado'].includes(String(t.status))) {
        const solveDate = t.solvedate
          ? new Date(t.solvedate)
          : (t.closedate ? new Date(t.closedate) : (t.date_mod ? new Date(t.date_mod) : null));
        if (solveDate) return solveDate > limitDate ? 'Fora do SLA' : 'Dentro do SLA';
        return 'N/A';
      }
      // Aberto: compara com now
      return new Date() > limitDate ? 'Fora do SLA' : 'Dentro do SLA';
    }
  }

  // 3. Fallback inteligente: usa heurística baseada em prioridade + idade do ticket
  // Se é crítico (Alta/Muito Alta) e está aberto há mais de 7 dias, considera fora do SLA
  if (['4', '5', '6'].includes(String(t.priority))) {
    const created = t.date_creation ? new Date(t.date_creation) : null;
    if (created && !isNaN(created.getTime())) {
      const ageInDays = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
      // SLA típico: Alta=24h, Muito Alta=4h
      const limitDays = String(t.priority) === '5' ? 0.16 : (String(t.priority) === '6' ? 0.04 : 1);
      if (ageInDays > limitDays && !['5', '6'].includes(String(t.status))) {
        return 'Fora do SLA';
      }
    }
  }

  // 4. Sem dados suficientes para calcular — não classifica como N/A
  // para não poluir as métricas
  return 'Em Análise';
}

export async function getTicketDetails(supabase: SupabaseClient, company_id: string, ticket_id: number): Promise<any> {
  const apiUrl = process.env.GLPI_API_URL;
  const apiToken = process.env.GLPI_API_TOKEN;
  const userToken = process.env.GLPI_USER_TOKEN;

  if (!apiUrl || !apiToken || !userToken) {
    throw new Error('Credenciais globais do GLPI não configuradas.');
  }

  const { data: integrations, error: intError } = await supabase
    .from('company_integrations')
    .select('glpi_entity_id')
    .eq('company_id', company_id)
    .single();

  if (intError || !integrations || integrations.glpi_entity_id === null) {
    throw new Error('ID da Entidade do GLPI não configurado para esta empresa.');
  }

  const entityId = integrations.glpi_entity_id;

  const initResponse = await axios.get(`${apiUrl}/initSession`, {
    headers: {
      'App-Token': apiToken,
      'Authorization': `user_token ${userToken}`,
    },
  });

  const sessionToken = initResponse.data.session_token;
  const glpiApi = axios.create({
    baseURL: apiUrl,
    headers: {
      'App-Token': apiToken,
      'Session-Token': sessionToken,
    },
  });

  try {
    await glpiApi.post('/changeActiveEntities', {
      entities_id: String(entityId),
      is_recursive: false
    });

    const ticketRes = await glpiApi.get(`/Ticket/${ticket_id}?expand_dropdowns=true`);
    const tasksRes = await glpiApi.get(`/Ticket/${ticket_id}/TicketTask`);
    const followupsRes = await glpiApi.get(`/Ticket/${ticket_id}/ITILFollowup`); // in newer GLPI it's ITILFollowup, but maybe TicketFollowup. Wait, GLPI 9.5+ uses ITILFollowup

    const ticket = ticketRes.data;
    const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : [];
    const followups = Array.isArray(followupsRes.data) ? followupsRes.data : [];

    // Combine timeline
    const timeline = [
      ...tasks.map((t: any) => ({
        type: 'task',
        id: t.id,
        content: t.content,
        date: t.date,
        author: t.users_id_name || 'Técnico',
      })),
      ...followups.map((f: any) => ({
        type: 'followup',
        id: f.id,
        content: f.content,
        date: f.date,
        author: f.users_id_name || 'Requerente',
      }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ticket,
      timeline
    };
  } finally {
    try {
      await glpiApi.get('/killSession');
    } catch (_) {}
  }
}
