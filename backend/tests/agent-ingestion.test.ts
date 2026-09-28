import assert from 'node:assert/strict';
import test from 'node:test';

import type { MetricBatch } from '../src/types/agent';
import {
  ingestMetricBatch,
  recordAgentHeartbeat,
} from '../src/services/agent-ingestion-service';

const validBatch: MetricBatch = {
  sequence: 7,
  collected_at: '2026-09-28T12:00:00.000Z',
  host: {
    hostname: 'HV-01',
    cpu_percent: 23.4,
    memory_percent: 61.2,
    memory_total_mb: 65536,
    memory_used_mb: 40140,
    disk_percent: 48.9,
    uptime_seconds: 7200,
  },
  virtual_machines: [],
};

test('envia lote validado ao RPC atômico e usa chave idempotente por agente/sequence', async () => {
  let rpcName = '';
  let rpcArgs: Record<string, unknown> | undefined;
  const supabase = {
    rpc(name: string, args: Record<string, unknown>) {
      rpcName = name;
      rpcArgs = args;
      return Promise.resolve({
        data: [{ status: 'accepted', accepted_sequence_no: 7 }],
        error: null,
      });
    },
  } as any;

  const result = await ingestMetricBatch(supabase, 'agent-1', validBatch);

  assert.equal(result.status, 'accepted');
  assert.equal(rpcName, 'ingest_agent_metrics');
  assert.equal(rpcArgs?.p_agent_id, 'agent-1');
  assert.equal(rpcArgs?.p_sequence_no, 7);
  assert.equal(rpcArgs?.p_idempotency_key, 'agent-1:7');
});

test('não chama o banco quando o lote contém métrica inválida', async () => {
  let called = false;
  const supabase = {
    rpc() {
      called = true;
      return Promise.resolve({ data: [], error: null });
    },
  } as any;

  await assert.rejects(
    () => ingestMetricBatch(supabase, 'agent-1', {
      ...validBatch,
      host: { ...validBatch.host, cpu_percent: 101 },
    }),
    /INVALID_METRIC/,
  );
  assert.equal(called, false);
});

test('rejeita chave de idempotência que não corresponde ao agente e sequence', async () => {
  let called = false;
  const supabase = {
    rpc() {
      called = true;
      return Promise.resolve({ data: [], error: null });
    },
  } as any;

  await assert.rejects(
    () => ingestMetricBatch(supabase, 'agent-1', validBatch, 'agent-1:999'),
    /INVALID_PAYLOAD.*Idempotency-Key/,
  );
  assert.equal(called, false);
});

test('atualiza heartbeat e registra o último resultado da coleta', async () => {
  let updated: Record<string, unknown> | undefined;
  let filteredAgentId = '';
  const supabase = {
    from(table: string) {
      assert.equal(table, 'registered_agents');
      return {
        update(values: Record<string, unknown>) {
          updated = values;
          return {
            eq(column: string, value: string) {
              assert.equal(column, 'id');
              filteredAgentId = value;
              return {
                neq(neqColumn: string, neqValue: string) {
                  assert.equal(neqColumn, 'status');
                  assert.equal(neqValue, 'Revoked');
                  return {
                    select() {
                      return {
                        maybeSingle() {
                          return Promise.resolve({ data: { id: value }, error: null });
                        },
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  } as any;

  await recordAgentHeartbeat(supabase, 'agent-1', {
    source_time: '2026-09-28T12:00:00.000Z',
    uptime_seconds: 7200,
    agent_version: '1.0.0',
    last_created_sequence: 7,
    last_acked_sequence: 7,
    pending_count: 0,
    pending_bytes: 0,
    last_collection_result: 'success',
    last_error_code: null,
  });

  assert.equal(filteredAgentId, 'agent-1');
  assert.equal(updated?.agent_version, '1.0.0');
  assert.equal(updated?.last_error, null);
  assert.equal(updated?.status, 'Online');
});
