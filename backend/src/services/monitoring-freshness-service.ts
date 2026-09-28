export type MetricFreshnessStatus = 'Online' | 'Atencao' | 'Offline';

const STALE_AFTER_MS = 3 * 60 * 1000;
const OFFLINE_AFTER_MS = 10 * 60 * 1000;

export function getMetricFreshnessStatus(lastMetricsAt: string | null | undefined, now = new Date()): MetricFreshnessStatus {
  if (!lastMetricsAt) return 'Offline';
  const timestamp = new Date(lastMetricsAt).getTime();
  if (!Number.isFinite(timestamp)) return 'Offline';

  const age = Math.max(0, now.getTime() - timestamp);
  if (age >= OFFLINE_AFTER_MS) return 'Offline';
  if (age >= STALE_AFTER_MS) return 'Atencao';
  return 'Online';
}
