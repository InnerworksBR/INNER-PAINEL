import assert from 'node:assert/strict';
import test from 'node:test';
import { validateNetworkConfiguration, validateNetworkBatch } from '../src/services/network-validation-service';
import { applyNetworkFreshness } from '../src/services/network-freshness-service';
import { decryptSnmpCredential, encryptSnmpCredential, listCredentialMetadata } from '../src/services/network-config-service';

test('rejects overly broad network configurations and invalid sequence numbers', () => {
  assert.throws(() => validateNetworkConfiguration({ networks: [{ cidr: '10.0.0.0/8' }] }));
  assert.throws(() => validateNetworkConfiguration({ version: 1, enabled: true, collection_interval_seconds: 60, discovery_interval_seconds: 900, networks: [{ cidr: '10.0.0.0/24', enabled: true, excluded_ips: ['192.168.1.1'], credential_ids: [] }] }));
  assert.throws(() => validateNetworkConfiguration({ version: 1, enabled: true, collection_interval_seconds: 60, discovery_interval_seconds: 900, networks: [{ cidr: '10.0.0.0/24', enabled: true, credential_ids: [] }, { cidr: '10.0.0.128/25', enabled: true, credential_ids: [] }] }));
  assert.throws(() => validateNetworkBatch({ sequence: 0, collected_at: new Date().toISOString(), devices: [] }));
});

test('network batches strip unknown fields that could contain credentials before persistence', () => {
  const batch = validateNetworkBatch({ sequence: 1, collected_at: new Date().toISOString(), secret: 'unsafe', devices: [{ network_id: '11111111-1111-4111-8111-111111111111', device_uid: 'uid', ip_address: '10.0.0.1', device_name: 'sw', device_type: 'Switch', observed_at: new Date().toISOString(), result: 'success', community: 'unsafe', interfaces: [{ if_index: 1, name: 'eth0', community: 'unsafe' }] }] });
  assert.equal(JSON.stringify(batch).includes('unsafe'), false);
});

test('network configuration preserves an explicit shared physical scope only when it is a UUID', () => {
  const scope = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const config = validateNetworkConfiguration({
    version: 1, enabled: true, collection_interval_seconds: 60, discovery_interval_seconds: 900,
    networks: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', cidr: '10.44.0.0/24', enabled: true, network_scope_id: scope }],
  });
  assert.equal(config.networks[0].network_scope_id, scope);
  assert.throws(() => validateNetworkConfiguration({
    version: 1, enabled: true, collection_interval_seconds: 60, discovery_interval_seconds: 900,
    networks: [{ cidr: '10.44.0.0/24', enabled: true, network_scope_id: 'not-a-uuid' }],
  }), /scope/i);
});

test('rejects per-device observations too far in the future', () => {
  assert.throws(() => validateNetworkBatch({ sequence: 1, collected_at: new Date().toISOString(), devices: [{
    network_id: '11111111-1111-4111-8111-111111111111', device_uid: 'uid', ip_address: '10.0.0.1', device_name: 'sw', device_type: 'Switch',
    observed_at: new Date(Date.now() + 6 * 60_000).toISOString(), result: 'success', interfaces: [],
  }] }), /future/i);
});

test('network freshness distinguishes missing telemetry from physical device failure', () => {
  assert.equal(applyNetworkFreshness({ last_poll_at: '2026-10-19T12:00:00Z' }, new Date('2026-10-19T12:11:00Z')).telemetry_status, 'no_data');
});

test('credential metadata never returns encrypted or plaintext secret material', async () => {
  const db = { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: '1', name: 'core', version: '2c', encrypted_secret: 'my-community' }], error: null }) }) }) }) } as any;
  const result = await listCredentialMetadata(db, 'company');
  assert.equal(JSON.stringify(result).includes('my-community'), false);
});

test('SNMP credential encryption requires a configured key and round-trips with AES-GCM', () => {
  const previous = process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY;
  const integration = process.env.INTEGRATION_SECRET_KEY;
  try {
    delete process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY;
    delete process.env.INTEGRATION_SECRET_KEY;
    assert.throws(() => encryptSnmpCredential({ community: 'my-community' }), /required/);
    process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const envelope = encryptSnmpCredential({ community: 'my-community' });
    assert.equal(JSON.stringify(envelope).includes('my-community'), false);
    assert.deepEqual(decryptSnmpCredential(envelope), { community: 'my-community' });
  } finally {
    if (previous === undefined) delete process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY; else process.env.SNMP_CREDENTIAL_ENCRYPTION_KEY = previous;
    if (integration === undefined) delete process.env.INTEGRATION_SECRET_KEY; else process.env.INTEGRATION_SECRET_KEY = integration;
  }
});
