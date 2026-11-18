const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
function localParts(date: Date): Record<string, number> {
  return Object.fromEntries(formatter.formatToParts(date).filter(p => p.type !== 'literal').map(p => [p.type, Number(p.value)]));
}
export function monthsDue(enabledAt: string, now: Date): string[] {
  const start = localParts(new Date(enabledAt)); const current = localParts(now);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, 1));
  const end = new Date(Date.UTC(current.year, current.month - 1, 1));
  if (current.day === 1 && current.hour < 8) end.setUTCMonth(end.getUTCMonth() - 1);
  const months: string[] = [];
  while (cursor < end) {
    months.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, '0')}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}
