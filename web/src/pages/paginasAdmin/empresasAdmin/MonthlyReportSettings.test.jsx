import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import MonthlyReportSettings from './MonthlyReportSettings';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), put: vi.fn() } }));
afterEach(() => vi.resetAllMocks());

it('saves explicit recipients and activation for the selected company', async () => {
  api.get.mockResolvedValue({ data: { enabled: false, recipients: [] } });
  api.put.mockResolvedValue({ data: { enabled: true, recipients: ['cliente@example.com'] } });
  render(<MonthlyReportSettings companyId="abc" />);
  const toggle = await screen.findByLabelText(/ativar relatório mensal/i);
  fireEvent.click(toggle);
  fireEvent.change(screen.getByLabelText(/destinatários do relatório/i), { target: { value: 'cliente@example.com' } });
  fireEvent.click(screen.getByRole('button', { name: /salvar configuração do relatório/i }));
  await waitFor(() => expect(api.put).toHaveBeenCalledWith('/admin/companies/abc/monthly-glpi-settings', { enabled: true, recipients: 'cliente@example.com' }));
  expect(await screen.findByText(/configuração do relatório salva/i)).toBeInTheDocument();
});
