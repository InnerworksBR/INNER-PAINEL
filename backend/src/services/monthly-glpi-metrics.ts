export interface ReportPeriod { month: string; start: string; end: string }
export interface ReportMetrics {
  opened: number; openingDateFallback: number; solved: number; solvedDateMissing: number; unresolved: number; categories: Record<string, number>;
  priorities: Record<string, number>; observedAt: string;
}

const timezone = 'America/Sao_Paulo';
const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});

function localTimeToUtc(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let result = desired;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(partsFormatter.formatToParts(new Date(result)).map(p => [p.type, p.value]));
    const actual = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const correction = desired - actual;
    result += correction;
    if (!correction) break;
  }
  return new Date(result);
}

export function previousMonthPeriod(now: Date): ReportPeriod {
  const p = Object.fromEntries(partsFormatter.formatToParts(now).map(part => [part.type, part.value]));
  const endMonth = +p.month;
  const endYear = +p.year;
  const previous = new Date(Date.UTC(endYear, endMonth - 2, 1));
  const year = previous.getUTCFullYear();
  const month = previous.getUTCMonth() + 1;
  return periodForMonth(`${year}-${String(month).padStart(2, '0')}`);
}

export function periodForMonth(month: string): ReportPeriod {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Mês inválido');
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1));
  return { month, start: localTimeToUtc(year, number, 1).toISOString(), end: localTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, 1).toISOString() };
}

function glpiDate(value: unknown): number | null {
  if (!value || value === 'null' || value === '0000-00-00 00:00:00') return null;
  const raw = String(value);
  const match = /^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d):(\d\d)$/.exec(raw);
  const parsed = match ? localTimeToUtc(...match.slice(1).map(Number) as [number, number, number, number, number, number]).getTime() : Date.parse(raw);
  if (!Number.isFinite(parsed)) throw new Error('Data inválida recebida do GLPI');
  return parsed;
}

export function calculateMonthlyMetrics(tickets: any[], period: ReportPeriod, observedAt: string): ReportMetrics {
  const start = Date.parse(period.start); const end = Date.parse(period.end);
  const metrics: ReportMetrics = { opened: 0, openingDateFallback: 0, solved: 0, solvedDateMissing: 0, unresolved: 0, categories: {}, priorities: {}, observedAt };
  const priorities: Record<string, string> = { '1': 'Muito Baixa', '2': 'Baixa', '3': 'Média', '4': 'Alta', '5': 'Muito Alta', '6': 'Maior' };
  for (const t of tickets) {
    const opened = glpiDate(t.date || t.date_creation);
    const solved = glpiDate(t.solvedate);
    if (opened === null) throw new Error('Chamado sem data de abertura');
    if (opened >= start && opened < end) {
      metrics.opened++;
      if (!t.date) metrics.openingDateFallback++;
      const category = typeof t.category === 'string' && t.category.trim() ? t.category.trim() : 'Categoria não informada';
      const priority = priorities[String(t.priority)] || 'Prioridade não informada';
      for (const [target, key] of [[metrics.categories, category], [metrics.priorities, priority]] as Array<[Record<string, number>, string]>) {
        Object.defineProperty(target, key, { value: (Object.hasOwn(target, key) ? target[key] : 0) + 1, writable: true, enumerable: true, configurable: true });
      }
    }
    if (solved !== null && solved >= start && solved < end) metrics.solved++;
    if (solved === null && ['5', '6', 'Resolvido', 'Fechado'].includes(String(t.status))) metrics.solvedDateMissing++;
    if (!['5', '6', 'Resolvido', 'Fechado'].includes(String(t.status))) metrics.unresolved++;
  }
  return metrics;
}

export function parseReportRecipients(input: string): string[] {
  if (/\r|\n/.test(input)) throw new Error('Use vírgula ou ponto e vírgula para separar e-mails');
  const addresses = input.split(/[,;]/).map(value => value.trim().toLowerCase()).filter(Boolean);
  if (addresses.some(address => !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(address))) throw new Error('E-mail de destinatário inválido');
  return [...new Set(addresses)];
}
