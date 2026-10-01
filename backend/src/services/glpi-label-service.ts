import type { AxiosInstance } from 'axios';

export function readableGlpiName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const name = value.trim();
  return name && !/^\d+$/.test(name) ? name : null;
}

export async function resolveTicketLabels(api: AxiosInstance, ticket: any, cache = new Map<string, Promise<string | null>>()) {
  const lookup = (type: 'User' | 'ITILCategory', value: unknown): Promise<string | null> => {
    const expanded = readableGlpiName(value);
    if (expanded) return Promise.resolve(expanded);
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return Promise.resolve(null);
    const key = `${type}/${id}`;
    if (!cache.has(key)) {
      cache.set(key, api.get(`/${key}`).then(({ data }) => {
        const fullName = type === 'User'
          ? [data.firstname, data.realname].filter(Boolean).join(' ')
          : data.completename;
        return readableGlpiName(fullName) || readableGlpiName(data.name);
      }).catch(() => null));
    }
    return cache.get(key)!;
  };

  const category = await lookup('ITILCategory', ticket.itilcategories_id_name || ticket.itilcategories_id);
  // The recipient is the ticket creator, which can differ from its requesters.
  let requester: string | null = null;
  try {
    const { data } = await api.get(`/Ticket/${ticket.id}/Ticket_User`, { params: { expand_dropdowns: true } });
    const names = await Promise.all((Array.isArray(data) ? data : [])
      .filter((relation: any) => String(relation.type) === '1')
      .map((relation: any) => lookup('User', relation.users_id_name || relation.users_id)));
    requester = [...new Set(names.filter(Boolean))].join(', ') || null;
  } catch {
    // Missing relation permissions leave an explicit absence, never an internal ID.
  }
  return { requester, category };
}
