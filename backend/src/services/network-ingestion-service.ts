import type { SupabaseClient } from '@supabase/supabase-js';
import { validateNetworkBatch } from './network-validation-service';
export async function ingestNetworkBatch(db: SupabaseClient, agentId: string, companyId: string, input: unknown) {
  const batch = validateNetworkBatch(input);
  const { data, error } = await db.rpc('ingest_network_metric_batch', { p_agent_id: agentId, p_company_id: companyId, p_batch: batch });
  if (error) {
    const forbidden = error.message.includes('AGENT_SCOPE');
    throw Object.assign(new Error(forbidden ? 'O agente não tem acesso a esta rede ou empresa.' : 'Lote de rede inválido.'), { statusCode: forbidden ? 403 : 400 });
  }
  return (Array.isArray(data) ? data[0] : data) || { status: 'accepted', sequence: batch.sequence };
}
