import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MonthlyReports from './MonthlyReports';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
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

  it('generates and displays a partial preview without adding it to the monthly history', async () => {
    api.get.mockResolvedValue({ data: [] });
    let resolvePreview;
    api.post.mockReturnValue(new Promise(resolve => { resolvePreview = resolve; }));
    render(<MonthlyReports requestConfig={{ params: { company_id: 'abc' } }} />);
    await screen.findByText(/ainda não há relatórios mensais/i);
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório agora/i }));
    expect(screen.getByRole('button', { name: /gerando relatório/i })).toBeDisabled();
    resolvePreview({ data: { period_start: '2026-11-01', analysis: 'Análise parcial', is_preview: true, generated_at: '2026-11-05T14:00:00Z', metrics: { opened: 2, solved: 1, unresolved: 1, observedAt: '2026-11-05T14:00:00Z', categories: {}, priorities: {} } } });
    expect(await screen.findByText('Análise parcial')).toBeInTheDocument();
    expect(screen.getByText(/prévia do mês em andamento/i)).toBeInTheDocument();
    expect(screen.getByText(/não é salva nem enviada por e-mail/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith('/client/glpi/reports/preview', {}, { params: { company_id: 'abc' } });
  });

  it('keeps the page usable and shows a useful error if generation fails', async () => {
    api.get.mockResolvedValue({ data: [] });
    api.post.mockRejectedValue({ response: { data: { error: 'Verifique a configuração da OpenAI.' } } });
    render(<MonthlyReports requestConfig={{}} />);
    await screen.findByText(/ainda não há relatórios mensais/i);
    fireEvent.click(screen.getByRole('button', { name: /gerar relatório agora/i }));
    expect(await screen.findByText('Verifique a configuração da OpenAI.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /gerar relatório agora/i })).toBeEnabled());
  });
});
