import type {
  HyperVState,
  MetricBatch,
  HostMetricRecord,
  VirtualMachineMetricRecord,
} from '../types/agent';
import { AgentPayloadError } from '../types/agent';

const VM_STATES = new Set<HyperVState>(['Running', 'Off', 'Paused']);
const MAX_VIRTUAL_MACHINES = 500;
const MAX_PAYLOAD_BYTES = 1024 * 1024;

export function validateMetricBatch(input: unknown): MetricBatch {
  if (!isRecord(input)) throw new AgentPayloadError('INVALID_PAYLOAD', 'payload must be an object');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > MAX_PAYLOAD_BYTES) {
    throw new AgentPayloadError('PAYLOAD_TOO_LARGE', 'payload exceeds 1 MiB');
  }

  const sequence = readNonNegativeInteger(input.sequence, 'sequence');
  const collectedAt = readString(input.collected_at, 'collected_at');
  if (Number.isNaN(Date.parse(collectedAt))) {
    throw new AgentPayloadError('INVALID_PAYLOAD', 'collected_at must be an ISO timestamp');
  }

  const host = validateHost(input.host);
  if (!Array.isArray(input.virtual_machines)) {
    throw new AgentPayloadError('INVALID_PAYLOAD', 'virtual_machines must be an array');
  }
  if (input.virtual_machines.length > MAX_VIRTUAL_MACHINES) {
    throw new AgentPayloadError('PAYLOAD_TOO_LARGE', `at most ${MAX_VIRTUAL_MACHINES} VMs are allowed`);
  }

  return {
    sequence,
    collected_at: new Date(collectedAt).toISOString(),
    host,
    virtual_machines: input.virtual_machines.map(validateVirtualMachine),
  };
}

function validateHost(input: unknown): HostMetricRecord {
  if (!isRecord(input)) throw new AgentPayloadError('INVALID_PAYLOAD', 'host must be an object');
  const hostname = readString(input.hostname, 'host.hostname').trim();
  if (!hostname) throw new AgentPayloadError('INVALID_PAYLOAD', 'host.hostname is required');

  return {
    hostname,
    cpu_percent: readPercentage(input.cpu_percent, 'host.cpu_percent'),
    memory_percent: readPercentage(input.memory_percent, 'host.memory_percent'),
    memory_total_mb: readNonNegativeNumber(input.memory_total_mb, 'host.memory_total_mb'),
    memory_used_mb: readNonNegativeNumber(input.memory_used_mb, 'host.memory_used_mb'),
    disk_percent: readPercentage(input.disk_percent, 'host.disk_percent'),
    uptime_seconds: readNonNegativeNumber(input.uptime_seconds, 'host.uptime_seconds'),
  };
}

function validateVirtualMachine(input: unknown): VirtualMachineMetricRecord {
  if (!isRecord(input)) throw new AgentPayloadError('INVALID_PAYLOAD', 'virtual machine must be an object');
  const hypervId = readString(input.hyperv_id, 'virtual_machines[].hyperv_id').trim();
  const name = readString(input.name, 'virtual_machines[].name').trim();
  const state = readString(input.state, 'virtual_machines[].state') as HyperVState;
  if (!hypervId || !name) throw new AgentPayloadError('INVALID_PAYLOAD', 'VM identity is required');
  if (!VM_STATES.has(state)) throw new AgentPayloadError('INVALID_METRIC', `unsupported VM state: ${state}`);

  return {
    hyperv_id: hypervId,
    name,
    state,
    cpu_percent: readOptionalPercentage(input.cpu_percent, 'virtual_machines[].cpu_percent'),
    memory_assigned_mb: readOptionalNonNegativeNumber(input.memory_assigned_mb, 'virtual_machines[].memory_assigned_mb'),
    memory_used_mb: readOptionalNonNegativeNumber(input.memory_used_mb, 'virtual_machines[].memory_used_mb'),
    uptime_seconds: readOptionalNonNegativeNumber(input.uptime_seconds, 'virtual_machines[].uptime_seconds'),
    virtual_disk_size_gb: readOptionalNonNegativeNumber(input.virtual_disk_size_gb, 'virtual_machines[].virtual_disk_size_gb'),
  };
}

function readString(value: unknown, field: string): string {
  if (typeof value !== 'string') throw new AgentPayloadError('INVALID_PAYLOAD', `${field} must be a string`);
  return value;
}

function readNonNegativeInteger(value: unknown, field: string): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new AgentPayloadError('INVALID_METRIC', `${field} must be a non-negative integer`);
  }
  return value as number;
}

function readNonNegativeNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new AgentPayloadError('INVALID_METRIC', `${field} must be a finite non-negative number`);
  }
  return value;
}

function readOptionalNonNegativeNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return readNonNegativeNumber(value, field);
}

function readPercentage(value: unknown, field: string): number {
  const number = readNonNegativeNumber(value, field);
  if (number > 100) throw new AgentPayloadError('INVALID_METRIC', `${field} must be between 0 and 100`);
  return number;
}

function readOptionalPercentage(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null;
  return readPercentage(value, field);
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
