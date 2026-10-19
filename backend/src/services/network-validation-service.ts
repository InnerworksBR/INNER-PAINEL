import { AgentPayloadError } from '../types/agent';

const MAX_ADDRESSES = 4096;
const MAX_NETWORKS = 256;
const MAX_CREDENTIALS = 1024;
const RESULTS = new Set(['success', 'partial', 'timeout', 'auth_error', 'protocol_error']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(v: unknown): v is Record<string, any> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function ipv4(value: unknown): number[] {
  if (typeof value !== 'string' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(value)) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR/IP inválido');
  const strings = value.split('.');
  if (strings.some(part => part.length > 1 && part.startsWith('0'))) throw new AgentPayloadError('INVALID_PAYLOAD', 'IPv4 must use canonical dotted decimal without leading zeroes');
  const parts = strings.map(Number);
  if (parts.some(part => part > 255)) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR/IP inválido');
  return parts;
}
export function cidrSize(cidr: string): number {
  const [ip, prefixText, extra] = cidr.split('/');
  if (extra !== undefined || prefixText === undefined) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR IPv4 obrigatório');
  ipv4(ip);
  if (!/^(0|[1-9]|[12]\d|3[0-2])$/.test(prefixText)) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR prefix must be canonical integer text');
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) throw new AgentPayloadError('INVALID_PAYLOAD', 'Prefixo CIDR inválido');
  return 2 ** (32 - prefix);
}
function ipNumber(ip: string) { return ipv4(ip).reduce((value, part) => value * 256 + part, 0); }
export function validateNetworkConfiguration(input: unknown): any {
  if (!record(input) || !Array.isArray(input.networks)) throw new AgentPayloadError('INVALID_PAYLOAD', 'configuration must contain networks');
  if (input.networks.length > MAX_NETWORKS) throw new AgentPayloadError('INVALID_PAYLOAD', 'configuration exceeds 256 networks');
  let total = 0; const ranges: Array<[number, number]> = []; const ids = new Set<string>(); const credentials = new Set<string>();
  const networks = input.networks.map((item: unknown) => {
    if (!record(item) || typeof item.cidr !== 'string' || typeof item.enabled !== 'boolean') throw new AgentPayloadError('INVALID_PAYLOAD', 'network item invalid');
    if (item.id !== undefined && (typeof item.id !== 'string' || !UUID.test(item.id))) throw new AgentPayloadError('INVALID_PAYLOAD', 'network id must be a UUID');
    if (item.id && ids.has(item.id.toLowerCase())) throw new AgentPayloadError('INVALID_PAYLOAD', 'duplicate network id');
    if (item.id) ids.add(item.id.toLowerCase());
    const size = cidrSize(item.cidr); total += size;
    const [ip] = item.cidr.split('/'); const address = ipNumber(ip); const start = Math.floor(address / size) * size; const end = start + size - 1;
    if (address !== start) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR network address must be canonical with host bits zero');
    const prohibited = [[0, 0x00ffffff], [0x7f000000, 0x7fffffff], [0xa9fe0000, 0xa9feffff], [0xe0000000, 0xefffffff]];
    if (prohibited.some(([lo, hi]) => start <= hi && end >= lo)) throw new AgentPayloadError('INVALID_PAYLOAD', 'CIDR contains loopback, link-local, multicast or reserved addresses');
    if (ranges.some(([lo, hi]) => start <= hi && end >= lo)) throw new AgentPayloadError('INVALID_PAYLOAD', 'overlapping network CIDRs are not allowed');
    ranges.push([start, end]);
    if (total > MAX_ADDRESSES) throw new AgentPayloadError('INVALID_PAYLOAD', 'configuration exceeds 4096 IPv4 addresses');
    if (!Number.isInteger(item.snmp_port ?? 161) || (item.snmp_port ?? 161) < 1 || (item.snmp_port ?? 161) > 65535) throw new AgentPayloadError('INVALID_PAYLOAD', 'SNMP port invalid');
    if (!Array.isArray(item.excluded_ips ?? []) || !(item.excluded_ips ?? []).every((v: unknown) => typeof v === 'string' && ipNumber(v) >= start && ipNumber(v) <= end)) throw new AgentPayloadError('INVALID_PAYLOAD', 'excluded_ips must be IPv4 addresses within the CIDR');
    if (!Array.isArray(item.credential_ids ?? []) || (item.credential_ids ?? []).length > 4 || !(item.credential_ids ?? []).every((id: unknown) => typeof id === 'string' && UUID.test(id))) throw new AgentPayloadError('INVALID_PAYLOAD', 'at most 4 UUID credential references per network');
    const refs = (item.credential_ids ?? []) as string[];
    if (new Set(refs.map(id => id.toLowerCase())).size !== refs.length) throw new AgentPayloadError('INVALID_PAYLOAD', 'duplicate credential reference');
    refs.forEach(id => credentials.add(id.toLowerCase()));
    if (credentials.size > MAX_CREDENTIALS) throw new AgentPayloadError('INVALID_PAYLOAD', 'configuration exceeds 1024 credentials');
    if (item.network_scope_id != null && (typeof item.network_scope_id !== 'string' || !UUID.test(item.network_scope_id))) throw new AgentPayloadError('INVALID_PAYLOAD', 'network_scope_id must be an authorized scope UUID');
    return { id: typeof item.id === 'string' ? item.id : undefined, cidr: item.cidr, enabled: item.enabled, snmp_port: item.snmp_port ?? 161, excluded_ips: item.excluded_ips ?? [], credential_ids: item.credential_ids ?? [], ...(item.network_scope_id ? { network_scope_id: item.network_scope_id } : {}) };
  });
  if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.collection_interval_seconds) || input.collection_interval_seconds < 30 || input.collection_interval_seconds > 3600 || !Number.isInteger(input.discovery_interval_seconds) || input.discovery_interval_seconds < 60 || input.discovery_interval_seconds > 86400) throw new AgentPayloadError('INVALID_PAYLOAD', 'configuration intervals invalid');
  return { version: Number.isInteger(input.version) ? input.version : 0, enabled: input.enabled, collection_interval_seconds: input.collection_interval_seconds, discovery_interval_seconds: input.discovery_interval_seconds, networks };
}
export function validateNetworkBatch(input: unknown): any {
  if (!record(input) || !Number.isSafeInteger(input.sequence) || input.sequence < 1 || !Array.isArray(input.devices) || input.devices.length > 5000 || typeof input.collected_at !== 'string' || !Number.isFinite(Date.parse(input.collected_at)) || Date.parse(input.collected_at) > Date.now() + 5 * 60_000) throw new AgentPayloadError('INVALID_PAYLOAD', 'network batch invalid');
  if (Buffer.byteLength(JSON.stringify(input), 'utf8') > 4 * 1024 * 1024) throw new AgentPayloadError('PAYLOAD_TOO_LARGE', 'network batch exceeds 4 MiB');
  const seenDevices = new Set<string>();
  const devices = input.devices.map((device: unknown) => {
    if (!record(device) || typeof device.network_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(device.network_id) || typeof device.device_uid !== 'string' || !device.device_uid || device.device_uid.length > 512 || typeof device.ip_address !== 'string' || typeof device.device_name !== 'string' || !device.device_name || device.device_name.length > 255 || typeof device.device_type !== 'string' || device.device_type.length > 100 || !RESULTS.has(device.result) || !Array.isArray(device.interfaces) || device.interfaces.length > 4096) throw new AgentPayloadError('INVALID_PAYLOAD', 'network device invalid');
    ipv4(device.ip_address);
    const identity = `${device.network_id}:${device.device_uid}`;
    if (seenDevices.has(identity)) throw new AgentPayloadError('INVALID_PAYLOAD', 'duplicate device identity in batch');
    seenDevices.add(identity);
    if (typeof device.observed_at !== 'string' || !Number.isFinite(Date.parse(device.observed_at)) || Date.parse(device.observed_at) > Date.now() + 5 * 60_000) throw new AgentPayloadError('INVALID_PAYLOAD', 'observed_at invalid or too far in the future');
    for (const key of ['sys_object_id','sys_description','manufacturer','model','serial_number','firmware_version','location','engine_id']) if (device[key] != null && (typeof device[key] !== 'string' || device[key].length > 4096)) throw new AgentPayloadError('INVALID_PAYLOAD', `${key} must be a bounded string or null`);
    if (device.sys_contact != null && (typeof device.sys_contact !== 'string' || device.sys_contact.length > 1024)) throw new AgentPayloadError('INVALID_PAYLOAD', 'sys_contact must be a bounded string or null');
    for (const key of ['uptime_seconds','response_time_ms']) if (device[key] != null && (typeof device[key] !== 'number' || !Number.isFinite(device[key]) || device[key] < 0)) throw new AgentPayloadError('INVALID_PAYLOAD', `${key} must be a non-negative number or null`);
    const interfaces = device.interfaces.map((item: unknown) => {
      if (!record(item) || !Number.isInteger(item.if_index) || item.if_index < 0 || typeof item.name !== 'string' || item.name.length > 255) throw new AgentPayloadError('INVALID_PAYLOAD', 'network interface invalid');
      for (const key of ['in_octets','out_octets','in_errors','out_errors','in_discards','out_discards']) if (item[key] != null && (typeof item[key] !== 'string' || !/^\d+$/.test(item[key]))) throw new AgentPayloadError('INVALID_PAYLOAD', `${key} must be a decimal string`);
      for (const key of ['speed_bps','in_bps','out_bps']) if (item[key] != null && (typeof item[key] !== 'number' || !Number.isFinite(item[key]) || item[key] < 0)) throw new AgentPayloadError('INVALID_PAYLOAD', `${key} must be a non-negative number`);
      if (item.if_type != null && (!Number.isInteger(item.if_type) || item.if_type < 0 || item.if_type > 65535)) throw new AgentPayloadError('INVALID_PAYLOAD', 'if_type must be a non-negative standard numeric code or null');
      const allowed = ['if_index','name','description','mac_address','if_type','admin_status','oper_status','speed_bps','in_octets','out_octets','in_errors','out_errors','in_discards','out_discards','in_bps','out_bps'];
      return Object.fromEntries(allowed.filter(key => item[key] !== undefined).map(key => [key, item[key]]));
    });
    return {
      network_id: device.network_id, device_uid: device.device_uid, ip_address: device.ip_address,
      device_name: device.device_name, device_type: device.device_type, observed_at: new Date(device.observed_at).toISOString(),
      result: device.result,
      ...Object.fromEntries(['sys_object_id','sys_description','sys_contact','uptime_seconds','response_time_ms','manufacturer','model','serial_number','firmware_version','location','engine_id'].filter(key => device[key] !== undefined).map(key => [key, device[key]])),
      interfaces,
    };
  });
  return { sequence: input.sequence, collected_at: new Date(input.collected_at).toISOString(), devices };
}
