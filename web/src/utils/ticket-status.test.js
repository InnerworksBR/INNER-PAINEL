import { expect, it } from 'vitest';
import { isResolvedTicket } from './ticket-status';
it('matches backend resolution criteria including GLPI numeric statuses', () => {
  for (const status of [5, 6, '5', 'Resolvido', 'Fechado', 'Solucionado', 'Closed', ' Resolved ']) expect(isResolvedTicket(status)).toBe(true);
  for (const status of [1, 2, 3, 4, 'Novo', 'Pendente', 'Em Andamento', 'open', null]) expect(isResolvedTicket(status)).toBe(false);
});
