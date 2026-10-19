import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../services/api';
import AssetDetailDrawer from './AssetDetailDrawer';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../context/ClientPreviewContext', () => ({ useClientRequestConfig: () => ({}) }));

describe('AssetDetailDrawer network telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: {
      display_name: 'SW-01', asset_type: 'switch',
      telemetry: {
        status: 'Sem resposta SNMP', telemetry_status: 'fresh', result: 'timeout', ip_address: '192.168.10.2',
        last_poll_at: '2026-10-19T12:00:00.000Z', manufacturer: 'Inner Networks', model: 'SW-48', sys_contact: 'noc@example.invalid',
        interfaces: [{ if_index: 1, name: 'Uplink', if_type: 6, admin_status: 1, oper_status: 2, in_octets: '9007199254741001', out_octets: '4294967298', in_bps: 0, out_bps: null }],
      },
    } });
  });

  it('shows SNMP freshness separately and preserves exact 64-bit interface counters', async () => {
    render(<AssetDetailDrawer asset={{ id: 'network-1', device_name: 'SW-01' }} sourceType="network_device" onClose={() => {}} />);

    expect(await screen.findByText('Atualizada')).toBeInTheDocument();
    expect(screen.getAllByText('Sem resposta SNMP').length).toBeGreaterThan(0);
    expect(screen.getByText('9007199254741001')).toBeInTheDocument();
    expect(screen.getByText('4294967298')).toBeInTheDocument();
    expect(screen.getByText('0 bps')).toBeInTheDocument();
    expect(screen.getByText('Contato SNMP')).toBeInTheDocument();
  });
});
