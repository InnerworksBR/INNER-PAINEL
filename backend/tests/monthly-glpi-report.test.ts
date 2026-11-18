import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateMonthlyMetrics, previousMonthPeriod, parseReportRecipients } from '../src/services/monthly-glpi-metrics';

test('previous month respects São Paulo month boundary and year rollover', () => {
  assert.deepEqual(previousMonthPeriod(new Date('2027-01-01T02:30:00Z')), {
    month: '2026-11', start: '2026-11-01T03:00:00.000Z', end: '2026-12-01T03:00:00.000Z',
  });
  assert.deepEqual(previousMonthPeriod(new Date('2027-01-01T11:00:00Z')), {
    month: '2026-12', start: '2026-12-01T03:00:00.000Z', end: '2027-01-01T03:00:00.000Z',
  });
});

test('counts opened and solved separately and current backlog without inventing SLA', () => {
  const period = { month: '2026-10', start: '2026-10-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' };
  const result = calculateMonthlyMetrics([
    { date: '2026-10-01 00:00:00', solvedate: '2026-10-02 10:00:00', status: 5, priority: 3, category: 'Hardware' },
    { date: '2026-09-03 12:00:00', solvedate: '2026-10-31 23:00:00', status: 6, priority: 4 },
    { date: '2026-10-31 23:59:59', status: 2, priority: 4 },
    { date: '2026-11-01 00:00:00', status: 1, priority: 4 },
  ], period, '2026-11-01T11:00:00.000Z');
  assert.equal(result.opened, 2);
  assert.equal(result.solved, 2);
  assert.equal(result.unresolved, 2);
  assert.deepEqual(result.categories, { Hardware: 1, 'Categoria não informada': 1 });
  assert.equal(result.observedAt, '2026-11-01T11:00:00.000Z');
});

test('exposes solved tickets lacking a solution date as an incomplete metric', () => {
  const period = { month: '2026-10', start: '2026-10-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' };
  const result = calculateMonthlyMetrics([{ date: '2026-09-01 10:00:00', status: 5, solvedate: null }], period, '2026-11-01T11:00:00.000Z');
  assert.equal(result.solved, 0);
  assert.equal(result.solvedDateMissing, 1);
});

test('uses the GLPI opening date rather than the record creation date', () => {
  const period = { month: '2026-10', start: '2026-10-01T03:00:00.000Z', end: '2026-11-01T03:00:00.000Z' };
  const result = calculateMonthlyMetrics([{ date: '2026-10-30 10:00:00', date_creation: '2026-11-02 10:00:00', status: 2 }], period, '2026-11-03T11:00:00.000Z');
  assert.equal(result.opened, 1);
});

test('deduplicates explicit addresses and rejects invalid or header-injection input', () => {
  assert.deepEqual(parseReportRecipients('A@empresa.com, a@empresa.com; b@empresa.com'), ['a@empresa.com', 'b@empresa.com']);
  assert.throws(() => parseReportRecipients('cliente@empresa.com\r\nBcc: estranho@empresa.com'));
  assert.throws(() => parseReportRecipients('invalido'));
});
