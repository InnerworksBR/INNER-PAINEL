import assert from 'node:assert/strict';
import test from 'node:test';

import { getMetricFreshnessStatus } from '../src/services/monitoring-freshness-service';

test('classifica atualização recente, stale e offline', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');

  assert.equal(getMetricFreshnessStatus('2026-09-28T11:59:00.000Z', now), 'Online');
  assert.equal(getMetricFreshnessStatus('2026-09-28T11:55:00.000Z', now), 'Atencao');
  assert.equal(getMetricFreshnessStatus('2026-09-28T11:45:00.000Z', now), 'Offline');
  assert.equal(getMetricFreshnessStatus(null, now), 'Offline');
});
