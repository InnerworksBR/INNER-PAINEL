import test from 'node:test';
import assert from 'node:assert/strict';
import { generateManualGlpiPreview } from '../src/services/manual-glpi-preview';

test('manual preview uses the current São Paulo month up to now and returns no saved report', async () => {
  const now = new Date('2026-11-05T14:00:00.000Z');
  let collectedCompany = '';
  let analysisInput: any;
  const report = await generateManualGlpiPreview({} as any, 'company-one', {
    now: () => now,
    collect: async (_db, company) => {
      collectedCompany = company;
      return [
        { date: '2026-11-02 10:00:00', status: 2 },
        { date: '2026-11-10 10:00:00', status: 2 },
        { date: '2026-10-15 10:00:00', solvedate: '2026-11-04 10:00:00', status: 5 },
      ];
    },
    generate: async (metrics, month, options) => { analysisInput = { metrics, month, options }; return 'Análise parcial'; },
  });
  assert.equal(collectedCompany, 'company-one');
  assert.equal(report.period_start, '2026-11-01');
  assert.equal(report.metrics.opened, 1);
  assert.equal(report.metrics.solved, 1);
  assert.equal(report.analysis, 'Análise parcial');
  assert.equal(report.is_preview, true);
  assert.equal(report.generated_at, now.toISOString());
  assert.equal(analysisInput.month, '2026-11');
  assert.equal(analysisInput.options.partial, true);
});

test('month selection uses São Paulo rather than UTC at midnight', async () => {
  const report = await generateManualGlpiPreview({} as any, 'company-one', {
    now: () => new Date('2026-12-01T01:00:00Z'),
    collect: async () => [],
    generate: async () => 'Prévia',
  });
  assert.equal(report.period_start, '2026-11-01');
});
