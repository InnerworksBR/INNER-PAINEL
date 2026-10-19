import assert from 'node:assert/strict';
import test from 'node:test';

import { getScheduledSyncTypes, NETWORK_RAW_RETENTION_CRON, purgeRetainedAgentData } from '../src/jobs/sync-scheduler';

test('scheduler operacional não agenda Zabbix', () => {
  const types = getScheduledSyncTypes();
  assert.deepEqual(types, ['glpi', 'ms365']);
  assert.equal(types.some(type => type.startsWith('zabbix')), false);
});

test('raw network samples and batches drain repeated bounded calls each hourly run', async () => {
  assert.equal(NETWORK_RAW_RETENTION_CRON, '0 0 * * * *');
  const calls: Array<[string, Record<string, unknown>]> = [];
  let networkBatches = 0;
  const db = { rpc(name: string, args: Record<string, unknown>) {
    calls.push([name, args]);
    if (name === 'purge_agent_metrics') return Promise.resolve({ error: null });
    return { abortSignal: async () => ({ data: { batches_deleted: 10, samples_deleted: 5000, has_more_batches: false, has_more_samples: ++networkBatches === 1 }, error: null }) };
  } } as any;
  const result = await purgeRetainedAgentData(db, { maxBatches: 4, batchSize: 5000, timeBudgetMs: 5_000 });
  assert.equal(result.batches, 2);
  assert.equal(result.samplesDeleted, 10_000);
  assert.equal(result.backlogRemaining, false);
  assert.deepEqual(calls, [
    ['purge_agent_metrics', { retention_days: 30 }],
    ['purge_network_agent_raw_data', { p_batch_limit: 5000 }],
    ['purge_network_agent_raw_data', { p_batch_limit: 5000 }],
  ]);
});

test('retention run reports unfinished backlog at its bounded work limit', async () => {
  const result = await purgeRetainedAgentData({ rpc(name: string) {
    return name === 'purge_agent_metrics' ? Promise.resolve({ error: null }) : { abortSignal: async () => ({ data: { batches_deleted: 5000, samples_deleted: 5000, has_more_batches: true, has_more_samples: true }, error: null }) };
  } } as any, { maxBatches: 2, batchSize: 5000, timeBudgetMs: 5_000 });
  assert.equal(result.batches, 2);
  assert.equal(result.backlogRemaining, true);
});

test('overlapping retention runs are skipped', async () => {
  let unblock!: () => void;
  const blocked = new Promise<void>(resolve => { unblock = resolve; });
  const db = { rpc(name: string) {
    return name === 'purge_agent_metrics' ? Promise.resolve({ error: null }) : { abortSignal: async () => { await blocked; return { data: { batches_deleted: 0, samples_deleted: 0, has_more_batches: false, has_more_samples: false }, error: null }; } };
  } } as any;
  const first = purgeRetainedAgentData(db, { timeBudgetMs: 5_000 });
  await new Promise(resolve => setImmediate(resolve));
  const overlapping = await purgeRetainedAgentData(db);
  assert.equal(overlapping.skipped, true);
  unblock();
  assert.equal((await first).skipped, false);
});
