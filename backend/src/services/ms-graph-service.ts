// src/services/ms-graph-service.ts
import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordSyncError, recordSyncSuccess } from './integration-status-service';

async function getAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const params = new URLSearchParams();
  params.append('client_id', clientId);
  params.append('scope', 'https://graph.microsoft.com/.default');
  params.append('client_secret', clientSecret);
  params.append('grant_type', 'client_credentials');

  try {
    const response = await axios.post(url, params);
    return response.data.access_token;
  } catch (error: any) {
    console.error('Erro ao obter token MS Graph:', error.response?.data || error.message);
    throw new Error('Falha na autenticação com Microsoft Graph: ' + (error.response?.data?.error_description || error.message));
  }
}

export async function syncMS365Metrics(supabase: SupabaseClient, company_id: string): Promise<{ message: string; count: number }> {
  try {
    // 1. Buscar credenciais
    const { data: integrations, error: intError } = await supabase
      .from('company_integrations')
      .select('ms_graph_tenant_id, ms_graph_client_id, ms_graph_client_secret')
      .eq('company_id', company_id)
      .single();

    if (intError || !integrations || !integrations.ms_graph_tenant_id) {
      throw new Error('Credenciais do MS365 não configuradas para esta empresa.');
    }

    const { ms_graph_tenant_id, ms_graph_client_id, ms_graph_client_secret } = integrations;

    const token = await getAccessToken(ms_graph_tenant_id, ms_graph_client_id, ms_graph_client_secret);

    const graphApi = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      headers: { Authorization: `Bearer ${token}` },
    });

    // 2. Buscar uso de licenças (SubscribedSkus)
    const skusResponse = await graphApi.get('/subscribedSkus');
    const skus = skusResponse.data.value;

    const metricsToUpsert = skus.map((sku: any) => ({
      company_id,
      license_name: sku.skuPartNumber,
      total: sku.prepaidUnits?.enabled || 0,
      used: sku.consumedUnits || 0,
      available: (sku.prepaidUnits?.enabled || 0) - (sku.consumedUnits || 0),
      last_updated: new Date().toISOString(),
    }));

    // 3. Salvar no Supabase
    if (metricsToUpsert.length > 0) {
      const { error } = await supabase
        .from('ms365_metrics')
        .upsert(metricsToUpsert, { onConflict: 'company_id,license_name' });

      if (error) throw error;
    }

    await recordSyncSuccess(supabase, company_id, 'ms365', metricsToUpsert.length);
    return { message: 'Métricas MS365 sincronizadas', count: metricsToUpsert.length };
  } catch (error: any) {
    console.error(`Erro na sincronização MS365 (Company ${company_id}):`, error.message);
    await recordSyncError(supabase, company_id, 'ms365', error.message);
    throw new Error('Erro na sincronização MS365: ' + error.message);
  }
}
