import test from 'node:test';
import assert from 'node:assert/strict';
import { processMonthlyReport } from '../src/jobs/monthly-glpi-reports';

test('an interrupted SMTP connection remains uncertain and is not sent twice on retry', async () => {
  const report: any = { id: 'report', company_id: 'one', period_start: '2026-10-01', metrics: { opened: 1, solved: 0, unresolved: 1 }, analysis: 'Resumo', recipient_snapshot: ['x@example.com', 'removed@example.com'], attempts: 0 };
  const deliveries: any[] = [];
  const settings = { company_id: 'one', enabled: true, recipients: ['x@example.com', 'new@example.com'] };
  const db: any = {
    rpc: async (name: string, args: any) => {
      if (name === 'claim_monthly_glpi_report') { report.lease_token = args.p_token; return { data: true, error: null }; }
      const row = deliveries.find(item => item.id === args.p_id && item.state === 'pending');
      if (row) { row.state = 'sending'; row.attempts++; }
      return { data: Boolean(row), error: null };
    },
    from: (table: string) => {
      let filters: Array<[string, any]> = []; let updates: any = null; let inserts: any[] | null = null;
      const query: any = {
        update: (value: any) => { updates = value; return query; },
        upsert: (value: any[]) => { inserts = value; return query; },
        select: () => query, order: () => query, gt: () => query,
        maybeSingle: () => Promise.resolve({ data: table === 'monthly_glpi_reports' ? report : settings, error: null }),
        eq: (key: string, value: any) => { filters.push([key, value]); return query; },
        then: (resolve: any) => {
          if (inserts) for (const item of inserts) if (!deliveries.some(row => row.recipient === item.recipient)) deliveries.push({ ...item, id: String(deliveries.length + 1), state: 'pending', attempts: 0 });
          const rows = (table === 'monthly_glpi_reports' ? [report] : deliveries).filter(row => filters.every(([key, value]) => row[key] === value));
          if (updates) rows.forEach(row => Object.assign(row, updates));
          resolve({ data: rows, error: null });
        },
      };
      return query;
    },
  };
  let sends = 0;
  const dependencies = { mailer: () => ({ from: 'sender@example.com', portalUrl: 'https://portal.example', transport: { sendMail: async () => { sends++; throw new Error('connection lost'); } } }) };
  await processMonthlyReport(db, report, { recipients: ['x@example.com'] }, { name: 'Empresa' }, dependencies as any);
  assert.equal(deliveries[0].state, 'uncertain');
  assert.equal(deliveries.find(row => row.recipient === 'removed@example.com').state, 'cancelled');
  assert.equal(deliveries.find(row => row.recipient === 'new@example.com').state, 'uncertain');
  assert.equal(report.attempts, 0);
  assert.equal(report.next_attempt_at, '9999-01-01T00:00:00.000Z');
  await processMonthlyReport(db, report, { recipients: ['x@example.com'] }, { name: 'Empresa' }, dependencies as any);
  assert.equal(sends, 2);
  assert.equal(deliveries[0].state, 'uncertain');
});
