import assert from 'node:assert/strict';
import test from 'node:test';

import { validateMetricBatch } from '../src/services/agent-validation-service';

const validBatch = () => ({
  sequence: 1,
  collected_at: '2026-09-28T15:00:00.000Z',
  host: {
    hostname: 'HV-01',
    cpu_percent: 32.4,
    memory_percent: 68.1,
    memory_total_mb: 65536,
    memory_used_mb: 44604,
    disk_percent: 54.7,
    uptime_seconds: 864000,
  },
  virtual_machines: [
    {
      hyperv_id: 'vm-1',
      name: 'VM-ERP',
      state: 'Running',
      cpu_percent: 21.3,
      memory_assigned_mb: 8192,
      memory_used_mb: 6144,
      uptime_seconds: 432000,
      virtual_disk_size_gb: 120,
    },
  ],
});

test('accepts a valid host and VM metric batch', () => {
  const result = validateMetricBatch(validBatch());

  assert.equal(result.sequence, 1);
  assert.equal(result.host.hostname, 'HV-01');
  assert.equal(result.virtual_machines[0].state, 'Running');
});

test('rejects CPU values outside the 0 to 100 range', () => {
  const payload = validBatch();
  payload.host.cpu_percent = 101;

  assert.throws(
    () => validateMetricBatch(payload),
    (error: unknown) => error instanceof Error && error.message.includes('INVALID_METRIC')
  );
});

test('rejects non-finite numeric values instead of coercing them to zero', () => {
  const payload = validBatch();
  payload.host.memory_percent = Number.NaN;

  assert.throws(
    () => validateMetricBatch(payload),
    (error: unknown) => error instanceof Error && error.message.includes('INVALID_METRIC')
  );
});

test('rejects negative uptime and unknown VM states', () => {
  const payload = validBatch();
  payload.host.uptime_seconds = -1;
  payload.virtual_machines[0].state = 'Unknown';

  assert.throws(
    () => validateMetricBatch(payload),
    (error: unknown) => error instanceof Error && error.message.includes('INVALID_METRIC')
  );
});

test('rejects an empty host name', () => {
  const payload = validBatch();
  payload.host.hostname = '  ';

  assert.throws(
    () => validateMetricBatch(payload),
    (error: unknown) => error instanceof Error && error.message.includes('INVALID_PAYLOAD')
  );
});
