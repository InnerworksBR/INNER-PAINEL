import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '../../../services/api';
import Rede from './rede';

let activeRequestConfig = {};
vi.mock('../../../services/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../../../context/ClientPreviewContext', () => ({
  useClientRequestConfig: () => activeRequestConfig,
  useClientPreview: () => ({ companyId: activeRequestConfig.params?.company_id || null }),
}));
vi.mock('../../../components/AssetDetailDrawer', () => ({ default: () => null }));

const emptyStats = { total: 0, online: 0, offline: 0, no_response: 0, no_data: 0, stale: 0, avgUptime: null, byType: {} };
const response = (data) => Promise.resolve({ data });

describe('Rede', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activeRequestConfig = { params: { company_id: 'company-a' } };
    api.get.mockImplementation((url) => response(url.endsWith('/devices') ? [] : url.endsWith('/stats') ? emptyStats : []));
  });

  it('explains an empty visible inventory without claiming no collector exists', async () => {
    render(<Rede />);

    expect(await screen.findByText(/lista vazia não confirma a ausência de coletor/i)).toBeInTheDocument();
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('refreshes network data every thirty seconds while the page stays open', async () => {
    vi.useFakeTimers();
    render(<Rede />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    const initialDeviceReads = api.get.mock.calls.filter(([url]) => url.endsWith('/devices')).length;

    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });

    expect(api.get.mock.calls.filter(([url]) => url.endsWith('/devices'))).toHaveLength(initialDeviceReads + 1);
    vi.useRealTimers();
  });

  it('ignores a pending response from the previous company after switching scope', async () => {
    const previousCompanyResponses = [];
    api.get.mockImplementation((url, config) => {
      if (config?.params?.company_id === 'company-a') return new Promise((resolve) => { previousCompanyResponses.push(resolve); });
      if (url.endsWith('/devices')) return response([{ id: 'device-b', device_name: 'SW-B', device_type: 'Switch', status: 'Online', telemetry_status: 'fresh', uptime_percent: 0 }]);
      if (url.endsWith('/stats')) return response({ ...emptyStats, total: 1, online: 1, avgUptime: 0 });
      return response([]);
    });
    const view = render(<Rede />);
    activeRequestConfig = { params: { company_id: 'company-b' } };
    view.rerender(<Rede />);

    expect(await screen.findByText('SW-B')).toBeInTheDocument();
    await waitFor(() => expect(previousCompanyResponses).toHaveLength(3));
    previousCompanyResponses[0]({ data: [{ id: 'device-a', device_name: 'SW-A', device_type: 'Switch', status: 'Offline' }] });
    previousCompanyResponses[1]({ data: { ...emptyStats, total: 99 } });
    previousCompanyResponses[2]({ data: [] });

    expect((await screen.findAllByText('0.0%')).length).toBeGreaterThan(0);
    expect(screen.queryByText('SW-A')).not.toBeInTheDocument();
    expect(screen.queryByText('99')).not.toBeInTheDocument();
  });
});
