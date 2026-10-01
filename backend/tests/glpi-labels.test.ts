import assert from 'node:assert/strict';
import test from 'node:test';
import axios from 'axios';
import { resolveTicketLabels } from '../src/services/glpi-label-service';

test('GLPI labels use the requester association and category name, not internal IDs or recipient', async () => {
  const api = axios.create({ adapter: async config => ({
    config, status: 200, statusText: 'OK', headers: {},
    data: config.url?.endsWith('/Ticket_User') ? [{ type: 1, users_id: 11 }, { type: 2, users_id: 214 }]
      : config.url === '/User/11' ? { firstname: 'Ana', realname: 'Silva', name: 'asilva' }
      : { completename: 'Suporte > Rede' },
  }) });
  assert.deepEqual(await resolveTicketLabels(api, { id: 1, users_id_recipient: 44, itilcategories_id: 3 }), { requester: 'Ana Silva', category: 'Suporte > Rede' });
});

test('expanded GLPI names remain readable in detail responses', async () => {
  const api = axios.create({ adapter: async config => ({ config, status: 200, statusText: 'OK', headers: {}, data: [{ type: 1, users_id: 'Ana Silva' }] }) });
  assert.deepEqual(await resolveTicketLabels(api, { id: 1, itilcategories_id: 'Suporte > Rede' }), { requester: 'Ana Silva', category: 'Suporte > Rede' });
});

test('unavailable GLPI relations never expose numeric IDs as names', async () => {
  const api = axios.create({ adapter: async () => { throw new Error('unavailable'); } });
  assert.deepEqual(await resolveTicketLabels(api, { id: 1, users_id_recipient: 44, itilcategories_id: 3 }), { requester: null, category: null });
});
