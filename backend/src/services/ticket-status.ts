const resolvedStatuses = new Set(['5', '6', 'resolvido', 'fechado', 'solucionado', 'closed', 'resolved', 'solved']);

export function isResolvedTicket(status: unknown): boolean {
  return resolvedStatuses.has(String(status ?? '').trim().toLowerCase());
}
