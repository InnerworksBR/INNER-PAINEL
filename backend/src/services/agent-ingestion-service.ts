import type { SupabaseClient } from '@supabase/supabase-js';

import { AgentPayloadError, type HeartbeatRequest, type MetricBatch } from '../types/agent';
import { validateMetricBatch } from './agent-validation-service';

export interface IngestionResult {
  status: 'accepted' | 'duplicate';
  accepted_sequence_no: number;
  accepted_at?: string;
}

export class AgentIngestionError extends Error {
  constructor(
    public readonly code: 'AGENT_NOT_FOUND' | 'INGESTION_ERROR',
    message: string,
    public readonly statusCode = code === 'AGENT_NOT_FOUND' ? 401 : 500,
  ) {
    super(`${code}: ${message}`);
    this.name = 'AgentIngestionError';
  }
}

export async function ingestMetricBatch(
  supabase: SupabaseClient,
  agentId: string,
  input: unknown,
): Promise<IngestionResult> {
  const batch = validateMetricBatch(input);
  const { data, error } = await supabase.rpc('ingest_agent_metrics', {
    p_agent_id: agentId,
    p_sequence_no: batch.sequence,
    p_idempotency_key: `${agentId}:${batch.sequence}`,
    p_collected_at: batch.collected_at,
    p_payload: {
      host: batch.host,
      virtual_machines: batch.virtual_machines,
    },
  });

  if (error) {
    if (error.message.includes('AGENT_NOT_FOUND')) {
      throw new AgentIngestionError('AGENT_NOT_FOUND', 'Agente não encontrado.');
    }
    throw new AgentIngestionError('INGESTION_ERROR', error.message);
  }

  const row = Array.isArray(data) ? data[0] : data;
  const status = row?.status === 'duplicate' ? 'duplicate' : 'accepted';
  return {
    status,
    accepted_sequence_no: Number(row?.accepted_sequence_no ?? batch.sequence),
    ...(row?.accepted_at ? { accepted_at: String(row.accepted_at) } : {}),
  };
}

export async function recordAgentHeartbeat(
  supabase: SupabaseClient,
  agentId: string,
  heartbeat: HeartbeatRequest,
): Promise<void> {
  validateHeartbeat(heartbeat);

  const { error } = await supabase
    .from('registered_agents')
    .update({
      status: 'Online',
      last_heartbeat: new Date().toISOString(),
      agent_version: heartbeat.agent_version.trim(),
      version: heartbeat.agent_version.trim(),
      last_error: heartbeat.last_collection_result === 'failed' ? heartbeat.last_error_code : null,
      metadata: {
        heartbeat_source_time: heartbeat.source_time,
        last_created_sequence: heartbeat.last_created_sequence,
        last_acked_sequence: heartbeat.last_acked_sequence,
        pending_count: heartbeat.pending_count,
        pending_bytes: heartbeat.pending_bytes,
        last_collection_result: heartbeat.last_collection_result,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', agentId);

  if (error) {
    throw new AgentIngestionError('INGESTION_ERROR', error.message);
  }
}

function validateHeartbeat(heartbeat: HeartbeatRequest): void {
  if (!heartbeat || typeof heartbeat !== 'object') {
    throw new AgentPayloadError('INVALID_PAYLOAD', 'heartbeat must be an object');
  }
  if (typeof heartbeat.source_time !== 'string' || Number.isNaN(Date.parse(heartbeat.source_time))) {
    throw new AgentPayloadError('INVALID_PAYLOAD', 'source_time must be an ISO timestamp');
  }
  if (typeof heartbeat.agent_version !== 'string' || !heartbeat.agent_version.trim()) {
    throw new AgentPayloadError('INVALID_PAYLOAD', 'agent_version is required');
  }

  for (const [field, value] of [
    ['uptime_seconds', heartbeat.uptime_seconds],
    ['last_created_sequence', heartbeat.last_created_sequence],
    ['last_acked_sequence', heartbeat.last_acked_sequence],
    ['pending_count', heartbeat.pending_count],
    ['pending_bytes', heartbeat.pending_bytes],
  ] as const) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
      (field.includes('sequence') || field === 'pending_count') && !Number.isInteger(value)) {
      throw new AgentPayloadError('INVALID_METRIC', `${field} must be a valid non-negative number`);
    }
  }
}
