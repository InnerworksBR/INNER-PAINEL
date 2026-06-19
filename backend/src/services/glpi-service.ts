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
    const pageSize = 200;
    const maxTickets = 5000;
    const tickets: any[] = [];

    for (let start = 0; start < maxTickets; start += pageSize) {
      const end = start + pageSize - 1;
      const response = await glpiApi.get('/Ticket', {
        params: {
          expand_dropdowns: true,
          range: `${start}-${end}`,
          order: 'DESC',
          sort: 'id',
        },
      });

      const page = Array.isArray(response.data) ? response.data : [];
      tickets.push(...page);
      if (page.length < pageSize) break;
    }

    // 3. Mapear e persistir
    // Migration SQL necessária: ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS glpi_date_mod timestamptz;
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

      if (error) throw error;
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
  if (t.sla_ttr_state !== undefined && t.sla_ttr_state !== null) {
    return String(t.sla_ttr_state) === '1' ? 'Fora do SLA' : 'Dentro do SLA';
  }
  if (!t.time_to_resolve || t.time_to_resolve === 'null') {
    return 'N/A';
  }

  const limitDate = new Date(t.time_to_resolve);
  if (isNaN(limitDate.getTime())) return 'N/A';

  // Resolvido ou Fechado
  if (['5', '6'].includes(String(t.status))) {
    const solveDate = t.solvedate ? new Date(t.solvedate) : (t.closedate ? new Date(t.closedate) : new Date(t.date_mod));
    return solveDate > limitDate ? 'Fora do SLA' : 'Dentro do SLA';
  }

  // Ainda aberto
  return new Date() > limitDate ? 'Fora do SLA' : 'Dentro do SLA';
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
