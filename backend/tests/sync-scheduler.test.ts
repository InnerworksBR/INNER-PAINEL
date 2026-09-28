import assert from 'node:assert/strict';
import test from 'node:test';

import { getScheduledSyncTypes } from '../src/jobs/sync-scheduler';

test('scheduler operacional não agenda Zabbix', () => {
  const types = getScheduledSyncTypes();
  assert.deepEqual(types, ['glpi', 'ms365']);
  assert.equal(types.some(type => type.startsWith('zabbix')), false);
});
