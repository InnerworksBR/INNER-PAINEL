import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAgentAssetKey,
  createAgentClaims,
  generateOpaqueToken,
  hashOpaqueToken,
  isActivationTokenUsable,
  parseAgentClaims,
} from '../src/services/agent-auth-service';

test('gera tokens opacos e hashes determinísticos sem expor o segredo', () => {
  const rawToken = generateOpaqueToken();
  const secondToken = generateOpaqueToken();

  assert.notEqual(rawToken, secondToken);
  assert.ok(rawToken.length >= 40);
  assert.equal(hashOpaqueToken(rawToken), hashOpaqueToken(rawToken));
  assert.notEqual(hashOpaqueToken(rawToken), rawToken);
});

test('aceita somente token de ativação ativo, não usado e dentro da validade', () => {
  const now = new Date('2026-09-28T12:00:00.000Z');
  const base = {
    is_active: true,
    used_at: null,
    expires_at: '2026-09-28T12:05:00.000Z',
  };

  assert.equal(isActivationTokenUsable(base, now), true);
  assert.equal(isActivationTokenUsable({ ...base, is_active: false }, now), false);
  assert.equal(isActivationTokenUsable({ ...base, used_at: '2026-09-28T11:59:00.000Z' }, now), false);
  assert.equal(isActivationTokenUsable({ ...base, expires_at: '2026-09-28T11:59:59.000Z' }, now), false);
});

test('mantém a chave de ativo estável por empresa e máquina', () => {
  assert.equal(buildAgentAssetKey('company-1', 'machine-1'), 'agent:company-1:machine-1');
  assert.notEqual(buildAgentAssetKey('company-1', 'machine-1'), buildAgentAssetKey('company-2', 'machine-1'));
});

test('cria claims de agente separados do JWT do portal', () => {
  assert.deepEqual(createAgentClaims({
    agent_id: 'agent-1',
    company_id: 'company-1',
  }), {
    kind: 'agent',
    agent_id: 'agent-1',
    company_id: 'company-1',
  });
});

test('não aceita claims de portal como identidade de agente', () => {
  assert.deepEqual(parseAgentClaims({
    kind: 'agent',
    agent_id: 'agent-1',
    company_id: 'company-1',
  }), {
    kind: 'agent',
    agent_id: 'agent-1',
    company_id: 'company-1',
  });

  assert.equal(parseAgentClaims({ user: { id: 'user-1' } }), null);
  assert.equal(parseAgentClaims({ kind: 'agent', agent_id: '', company_id: 'company-1' }), null);
});
