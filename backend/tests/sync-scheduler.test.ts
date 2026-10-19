import assert from 'node:assert/strict';
import test from 'node:test';

import { getScheduledSyncTypes, NETWORK_RAW_RETENTION_CRON, purgeRetainedAgentData } from '../src/jobs/sync-scheduler';

test('scheduler operacional não agenda Zabbix', () => {
  const types = getScheduledSyncTypes();
  assert.deepEqual(types, ['glpi', 'ms365']);
  assert.equal(types.some(type => type.startsWith('zabbix')), false);
});

test('raw network samples and batches are scheduled for hourly bounded retention', async () => {
  assert.equal(NETWORK_RAW_RETENTION_CRON, '0 0 * * * *');
  const calls: Array<[string, Record<string, unknown>]> = [];
  await purgeRetainedAgentData({ rpc: async (name: string, args: Record<string, unknown>) => { calls.push([name, args]); return { error: null }; } } as any);
  assert.deepEqual(calls, [
    ['purge_agent_metrics', { retention_days: 30 }],
    ['purge_network_agent_raw_data', { p_batch_limit: 5000 }],
  ]);
});
