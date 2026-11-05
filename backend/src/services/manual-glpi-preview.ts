import type { SupabaseClient } from '@supabase/supabase-js';
import { collectCompanyTickets } from './monthly-glpi-collection';
import { calculateMonthlyMetrics, periodForMonth } from './monthly-glpi-metrics';
import { generateMonthlyAnalysis } from './monthly-glpi-ai';

type PreviewDependencies = {
  now?: () => Date;
  collect?: typeof collectCompanyTickets;
  generate?: typeof generateMonthlyAnalysis;
};

export async function generateManualGlpiPreview(db: SupabaseClient, companyId: string, dependencies: PreviewDependencies = {}) {
  const tickets = await (dependencies.collect || collectCompanyTickets)(db, companyId);
  const observedAt = (dependencies.now || (() => new Date()))();
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit' }).formatToParts(observedAt);
  const year = parts.find(part => part.type === 'year')?.value;
  const monthNumber = parts.find(part => part.type === 'month')?.value;
  const month = `${year}-${monthNumber}`;
  const period = { ...periodForMonth(month), end: observedAt.toISOString() };
  const metrics = calculateMonthlyMetrics(tickets, period, observedAt.toISOString());
  const analysis = await (dependencies.generate || generateMonthlyAnalysis)(metrics, month, { partial: true });
  const generatedAt = (dependencies.now || (() => new Date()))();
  return { period_start: `${month}-01`, metrics, analysis, generated_at: generatedAt.toISOString(), is_preview: true };
}
