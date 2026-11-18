import assert from 'node:assert/strict';
import test from 'node:test';
import { monthsDue } from '../src/services/monthly-glpi-scheduling';

test('recovers all completed months since enablement after a long outage', () => {
  assert.deepEqual(monthsDue('2026-08-15T12:00:00Z', new Date('2026-11-01T11:00:00Z')), ['2026-08', '2026-09', '2026-10']);
});

test('does not generate the last month before 08:00 São Paulo on the first day', () => {
  assert.deepEqual(monthsDue('2026-09-15T12:00:00Z', new Date('2026-11-01T10:59:00Z')), ['2026-09']);
});
