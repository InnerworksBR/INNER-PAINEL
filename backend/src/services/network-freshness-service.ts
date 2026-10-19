export type NetworkTelemetryStatus = 'fresh' | 'stale' | 'no_data';
export function applyNetworkFreshness<T extends Record<string, any>>(device: T, now = new Date()): T & { telemetry_status: NetworkTelemetryStatus } {
  const time = device.last_poll_at || device.last_updated ? Date.parse(device.last_poll_at || device.last_updated) : NaN;
  const age = Number.isFinite(time) ? Math.max(0, now.getTime() - time) : Infinity;
  return { ...device, telemetry_status: age >= 10 * 60_000 ? 'no_data' : age >= 3 * 60_000 ? 'stale' : 'fresh' };
}
