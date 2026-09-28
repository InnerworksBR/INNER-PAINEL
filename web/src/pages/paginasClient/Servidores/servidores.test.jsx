import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import Servidores from './servidores';

const server = {
  id: 'server-1',
  hostname: 'SRVHOST01',
  status: 'Online',
  monitoring_source: 'agent_native',
  cpu_usage: 6.1004135435513,
  memory_usage: 45.6170840422859,
  disk_usage: 24.4478008491949,
  memory_used: 113.1,
  memory_total: 247.93274383545,
  disk_used: null,
  disk_total: 0,
  last_updated: '2026-09-28T21:15:30.251Z',
};

vi.mock('../../../hooks/useRealtimeSubscription', () => ({
  useRealtimeData: (endpoint) => ({
    data: endpoint === '/client/metrics/servers' ? [server] : [],
    loading: false,
    refresh: vi.fn(),
  }),
}));

describe('Servidores', () => {
  it('shows whole-number percentages and actual memory capacity', () => {
    render(<Servidores />);

    expect(screen.getAllByText('6%')).toHaveLength(2);
    expect(screen.getAllByText('46%')).toHaveLength(2);
    expect(screen.getByText('24%')).toBeInTheDocument();
    expect(screen.getByText('113 GB / 248 GB')).toBeInTheDocument();
    expect(screen.getByText('Capacidade não informada')).toBeInTheDocument();
  });
});
