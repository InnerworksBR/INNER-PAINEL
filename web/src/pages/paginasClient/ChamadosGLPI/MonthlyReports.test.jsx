import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonthlyReports from './MonthlyReports';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

describe('relatórios mensais', () => {
  it('shows the latest report and lets the customer select an older month', async () => {
    api.get.mockResolvedValue({ data: [
      { id: '1', period_start: '2026-10-01', analysis: 'Análise de outubro', metrics: { opened: 9, solved: 4, unresolved: 2, observedAt: '2026-11-01T11:00:00Z', categories: {}, priorities: {} } },
      { id: '2', period_start: '2026-09-01', analysis: 'Análise de setembro', metrics: { opened: 3, solved: 2, unresolved: 1, observedAt: '2026-10-01T11:00:00Z', categories: {}, priorities: {} } },
    ] });
    render(<MonthlyReports requestConfig={{}} />);
    expect(await screen.findByText('Análise de outubro')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mês do relatório'), { target: { value: '2' } });
    expect(screen.getByText('Análise de setembro')).toBeInTheDocument();
  });

  it('shows an error when the report list cannot be loaded', async () => {
    api.get.mockRejectedValue(new Error('offline'));
    render(<MonthlyReports requestConfig={{}} />);
    expect(await screen.findByText(/não foi possível carregar os relatórios/i)).toBeInTheDocument();
  });
});
