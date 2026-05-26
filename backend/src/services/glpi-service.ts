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
    const ticketsToUpsert = tickets.map((t: any) => ({
      glpi_id: t.id,
      title: t.name,
      status: mapGLPIStatus(t.status),
      sla_status: t.sla_state ? mapSLAStatus(t.sla_state) : 'N/A',
      priority: mapGLPIPriority(t.priority),
      requester: t.users_id_recipient_name || t.users_id_recipient || null,
      category: t.itilcategories_id_name || t.itilcategories_id || null,
      created_at: t.date_creation || t.date,
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

function mapSLAStatus(slaState: number | string): string {
  const slaMap: Record<string, string> = {
    '0': 'Dentro do SLA',
    '1': 'Fora do SLA',
  };
  return slaMap[String(slaState)] || 'N/A';
}
