import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import NOC from './noc';
vi.mock('../../../services/api', () => ({ default: { get: async () => ({ data: {
  totalCompanies: 2, statusCounts: { online: 2, warning: 0, critical: 0, offline: 0 },
  companies: [
    { id: '1', name: 'ABRAHY', status: 'online', ticketCount: { open: 0, critical: 0 }, slaCompliance: null },
    { id: '2', name: 'Outra', status: 'online', ticketCount: { open: 0, critical: 0 }, slaCompliance: 0 },
  ], recentTickets: [], recentAlerts: [],
} }) } }));
it('distinguishes missing SLA from a measured zero percent', async () => {
  render(<MemoryRouter><NOC /></MemoryRouter>);
  expect(await screen.findByText('Sem dados')).toBeInTheDocument();
  expect(screen.getByText('0%')).toBeInTheDocument();
  expect(screen.queryByText('%')).not.toBeInTheDocument();
});
