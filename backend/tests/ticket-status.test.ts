import assert from 'node:assert/strict';
import test from 'node:test';
import { isResolvedTicket } from '../src/services/ticket-status';
test('ticket resolution accepts numeric and translated statuses consistently', () => {
  for (const status of [5, 6, '5', 'Resolvido', 'Fechado', 'Solucionado', 'Closed', ' Resolved ']) assert.equal(isResolvedTicket(status), true);
  for (const status of [1, 2, 3, 4, 'Novo', 'Pendente', 'Em Andamento', 'open', null]) assert.equal(isResolvedTicket(status), false);
});
