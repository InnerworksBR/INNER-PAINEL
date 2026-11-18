import axios from 'axios';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readableGlpiName } from './glpi-label-service';

type Page = { data: any[]; total: number | null };
export async function collectTicketPages(fetchPage: (start: number, end: number) => Promise<Page>): Promise<any[]> {
  const size = 25; const tickets: any[] = []; const ids = new Set<string>();
  let expectedTotal: number | null = null;
  for (let start = 0; ; start += size) {
    const page = await fetchPage(start, start + size - 1);
    if (!Array.isArray(page.data)) throw new Error('Resposta incompleta do GLPI');
    if (page.total === null || !Number.isInteger(page.total) || page.total < 0) throw new Error('Total de chamados não informado pelo GLPI');
    if (expectedTotal !== null && page.total !== expectedTotal) throw new Error('Total de chamados mudou durante a coleta');
    expectedTotal = page.total;
    for (const ticket of page.data) {
      const id = String(ticket.id || '');
      if (!id || ids.has(id)) throw new Error('Página GLPI contém chamado ausente ou duplicado');
      ids.add(id); tickets.push(ticket);
    }
    if (tickets.length > page.total || (page.data.length < size && tickets.length < page.total)) throw new Error('Coleta incompleta do GLPI');
    if (tickets.length === page.total) return tickets;
  }
}

export async function collectCompanyTickets(db: SupabaseClient, companyId: string): Promise<any[]> {
  const url = (process.env.GLPI_API_URL || '').replace(/\/+$/, '');
  const appToken = process.env.GLPI_API_TOKEN; const userToken = process.env.GLPI_USER_TOKEN;
  if (!url || !appToken || !userToken) throw new Error('Credenciais GLPI não configuradas');
  const { data, error } = await db.from('company_integrations').select('glpi_entity_id').eq('company_id', companyId).single();
  if (error || data?.glpi_entity_id == null) throw new Error('Entidade GLPI não configurada');
  const session = await axios.post(`${url}/initSession`, {}, { headers: { 'App-Token': appToken, Authorization: `user_token ${userToken}` }, timeout: 30000 });
  if (!session.data?.session_token) throw new Error('Sessão GLPI inválida');
  const api = axios.create({ baseURL: url, timeout: 30000, headers: { 'App-Token': appToken, 'Session-Token': session.data.session_token } });
  try {
    await api.post('/changeActiveEntities', { entities_id: String(data.glpi_entity_id), is_recursive: false });
    const tickets = await collectTicketPages(async (start, end) => {
      const response = await api.get('/Ticket', { params: { range: `${start}-${end}`, expand_dropdowns: true, order: 'DESC', sort: 'id' } });
      const range = String(response.headers['content-range'] || '');
      const totalMatch = /\/(\d+)\s*$/.exec(range);
      return { data: response.data, total: totalMatch ? Number(totalMatch[1]) : null };
    });
    const categories = new Map<string, Promise<string | null>>();
    for (let offset = 0; offset < tickets.length; offset += 20) {
      await Promise.all(tickets.slice(offset, offset + 20).map(async t => {
        const value = t.itilcategories_id_name || t.itilcategories_id;
        let category = readableGlpiName(value);
        const id = Number(value);
        if (!category && Number.isInteger(id) && id > 0) {
          const key = String(id);
          if (!categories.has(key)) categories.set(key, api.get(`/ITILCategory/${id}`).then(res => {
            const name = readableGlpiName(res.data?.completename) || readableGlpiName(res.data?.name);
            if (!name) throw new Error('Categoria GLPI sem nome disponível');
            return name;
          }));
          category = await categories.get(key)!;
        }
        t.category = category;
      }));
    }
    return tickets;
  } finally {
    await api.get('/killSession').catch(() => undefined);
  }
}
