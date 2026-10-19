import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import NetworkAgentIntegration from './NetworkAgentIntegration';

vi.mock('../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }));

describe('NetworkAgentIntegration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockImplementation((url) => {
      if (url.endsWith('/network-agents')) return Promise.resolve({ data: [] });
      if (url.endsWith('/snmp-credentials')) return Promise.resolve({ data: [] });
      if (url.endsWith('/network-scopes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { version: 0, enabled: false, networks: [] } });
    });
  });

  it('claims an agent for the selected company and reports the linked machine', async () => {
    api.post.mockResolvedValueOnce({ data: { hostname: 'ROUTER-01', state: 'approved' } });
    render(<NetworkAgentIntegration companyId="company-a" />);

    fireEvent.change(await screen.findByLabelText(/código de vinculação/i), { target: { value: 'ABCD-EFGH-JKLM' } });
    fireEvent.click(screen.getByRole('button', { name: /vincular agente/i }));

    expect(await screen.findByText(/agente vinculado/i)).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(
      '/admin/monitoring/companies/company-a/network-agents/claim',
      { code: 'ABCD-EFGH-JKLM' },
    );
  });

  it('shows invalid pairing-code errors and keeps the code available for correction', async () => {
    api.post.mockRejectedValueOnce({ response: { data: { error: 'Código inválido ou expirado.' } } });
    render(<NetworkAgentIntegration companyId="company-a" />);
    const codeInput = await screen.findByLabelText(/código de vinculação/i);
    fireEvent.change(codeInput, { target: { value: 'AAAA-BBBB-CCCC' } });
    fireEvent.click(screen.getByRole('button', { name: /vincular agente/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou expirado.');
    expect(codeInput).toHaveValue('AAAA-BBBB-CCCC');
  });

  it('keeps the component out of the parent integrations form and blocks Enter submission from its inputs', async () => {
    const onParentSubmit = vi.fn((event) => event.preventDefault());
    const { container } = render(<form onSubmit={onParentSubmit}><NetworkAgentIntegration companyId="company-a" /></form>);
    const codeInput = await screen.findByLabelText(/código de vinculação/i);

    expect(container.querySelectorAll('form')).toHaveLength(1);
    fireEvent.keyDown(codeInput, { key: 'Enter', code: 'Enter', charCode: 13 });
    expect(onParentSubmit).not.toHaveBeenCalled();
  });

  it('clears credential secrets after saving and never reads saved secrets back', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/snmp-credentials')
      ? [{ id: 'credential-a', name: 'Leitura', version: '2c' }]
      : url.endsWith('/network-agents') ? [{ id: 'agent-a', hostname: 'COLETOR-A', status: 'Online', device_count: 0 }]
        : url.endsWith('/network-scopes') ? [] : { version: 1, enabled: true, networks: [] } }));
    api.post.mockResolvedValueOnce({ data: { id: 'credential-b', name: 'Novo', version: '2c' } });
    render(<NetworkAgentIntegration companyId="company-a" />);

    fireEvent.change(await screen.findByLabelText(/nome da credencial/i), { target: { value: 'Novo' } });
    fireEvent.change(screen.getByLabelText(/comunidade snmp/i), { target: { value: 'segredo-de-teste' } });
    fireEvent.click(screen.getByRole('button', { name: /salvar credencial/i }));

    await waitFor(() => expect(screen.getByLabelText(/comunidade snmp/i)).toHaveValue(''));
    expect(screen.queryByText('segredo-de-teste')).not.toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith(
      '/admin/monitoring/companies/company-a/snmp-credentials',
      expect.objectContaining({ name: 'Novo', version: '2c', community: 'segredo-de-teste' }),
    );
  });

  it('does not accept host bits in a configured network CIDR', async () => {
    api.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/network-agents')
      ? [{ id: 'agent-a', hostname: 'COLETOR-A', status: 'Online', device_count: 0 }]
      : url.endsWith('/snmp-credentials') ? [] : url.endsWith('/network-scopes') ? []
        : { version: 1, enabled: true, networks: [] } }));
    render(<NetworkAgentIntegration companyId="company-a" />);

    fireEvent.change(await screen.findByLabelText(/rede ipv4.*cidr/i), { target: { value: '192.168.10.5/24' } });
    fireEvent.click(screen.getByRole('button', { name: /adicionar rede/i }));

    expect(await screen.findByText(/endereço de rede.*bits de host/i)).toBeInTheDocument();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('shows the package-build recovery message when authenticated download returns 503', async () => {
    api.get.mockImplementation((url) => url === '/admin/monitoring/network-agent/download'
      ? Promise.reject({ response: { status: 503, data: { error: 'Pacote indisponível' } } })
      : Promise.resolve({ data: [] }));
    render(<NetworkAgentIntegration companyId="company-a" />);

    fireEvent.click(await screen.findByRole('button', { name: /baixar pacote windows/i }));

    expect(await screen.findByText(/pacote ainda não está disponível.*suporte.*gerar/i)).toBeInTheDocument();
  });

  it('discards the previous company response when the selected company changes', async () => {
    const finishCompanyA = [];
    api.get.mockImplementation((url) => {
      if (url.includes('/companies/company-a/')) return new Promise((resolve) => { finishCompanyA.push(resolve); });
      if (url.endsWith('/network-agents')) return Promise.resolve({ data: [{ id: 'agent-b', hostname: 'COLETOR-B', status: 'Online', device_count: 1 }] });
      if (url.endsWith('/snmp-credentials') || url.endsWith('/network-scopes')) return Promise.resolve({ data: [] });
      return Promise.resolve({ data: { version: 1, enabled: true, networks: [] } });
    });
    const view = render(<NetworkAgentIntegration companyId="company-a" />);
    view.rerender(<NetworkAgentIntegration companyId="company-b" />);

    expect(await screen.findByText('COLETOR-B')).toBeInTheDocument();
    await waitFor(() => expect(finishCompanyA).toHaveLength(3));
    finishCompanyA[0]({ data: [{ id: 'agent-a', hostname: 'COLETOR-A', status: 'Online', device_count: 1 }] });
    finishCompanyA[1]({ data: [] });
    finishCompanyA[2]({ data: [] });

    await waitFor(() => expect(screen.queryByText('COLETOR-A')).not.toBeInTheDocument());
    expect(api.get).toHaveBeenCalledWith('/admin/monitoring/companies/company-b/network-agents');
  });
});
