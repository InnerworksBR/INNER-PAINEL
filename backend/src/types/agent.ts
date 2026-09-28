export type HyperVState = 'Running' | 'Off' | 'Paused';

export interface HostMetricRecord {
  hostname: string;
  cpu_percent: number;
  memory_percent: number;
  memory_total_mb: number;
  memory_used_mb: number;
  disk_percent: number;
  uptime_seconds: number;
}

export interface VirtualMachineMetricRecord {
  hyperv_id: string;
  name: string;
  state: HyperVState;
  cpu_percent: number | null;
  memory_assigned_mb: number | null;
  memory_used_mb: number | null;
  uptime_seconds: number | null;
  virtual_disk_size_gb: number | null;
}

export interface MetricBatch {
  sequence: number;
  collected_at: string;
  host: HostMetricRecord;
  virtual_machines: VirtualMachineMetricRecord[];
}

export interface HeartbeatRequest {
  source_time: string;
  uptime_seconds: number;
  agent_version: string;
  last_created_sequence: number;
  last_acked_sequence: number;
  pending_count: number;
  pending_bytes: number;
  last_collection_result: 'success' | 'partial' | 'failed' | null;
  last_error_code: string | null;
}

export interface AgentPrincipal {
  agent_id: string;
  company_id: string;
  kind: 'agent';
}

export class AgentPayloadError extends Error {
  constructor(public readonly code: 'INVALID_PAYLOAD' | 'INVALID_METRIC' | 'PAYLOAD_TOO_LARGE', message: string) {
    super(`${code}: ${message}`);
    this.name = 'AgentPayloadError';
  }
}
