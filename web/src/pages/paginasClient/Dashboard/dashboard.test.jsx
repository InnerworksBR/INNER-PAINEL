import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Dashboard from './dashboard';
const state = vi.hoisted(() => ({ data: null }));
vi.mock('../../../hooks/useRealtimeSubscription', () => ({ useRealtimeData: () => ({ data: state.data, loading: false, refresh: vi.fn() }) }));
vi.mock('recharts', () => ({ ResponsiveContainer: ({ children }) => children, PieChart: () => null, Pie: () => null, Cell: () => null, Tooltip: () => null }));
it('does not label an environment with warnings operational', () => {
  state.data = { health: { hasData: true, healthy: 0, warning: 100, critical: 0 } };
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(screen.queryAllByText('Operacional')).toHaveLength(0);
  expect(screen.queryByText('Tudo operando normalmente')).not.toBeInTheDocument();
});
it('shows missing health data explicitly instead of a healthy percentage', () => {
  state.data = { health: { hasData: false, healthy: 0, warning: 0, critical: 0 } };
  render(<MemoryRouter><Dashboard /></MemoryRouter>);
  expect(screen.getAllByText('Sem dados').length).toBeGreaterThan(0);
  expect(screen.queryAllByText('Operacional')).toHaveLength(0);
});
