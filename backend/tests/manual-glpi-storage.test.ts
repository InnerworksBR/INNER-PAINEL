import test from 'node:test';
import assert from 'node:assert/strict';
import { getOrCreateManualGlpiPreview, PreviewBusyError } from '../src/services/manual-glpi-storage';

function memoryStore() {
  const rows = new Map<string, any>();
  const key = (company: string, period: string) => `${company}:${period}`;
  return {
    async get(company: string, period: string) { return rows.get(key(company, period))?.report || null; },
    async claim(company: string, period: string, token: string) {
      const row = rows.get(key(company, period));
      if (row?.report) return 'ready' as const;
      if (row?.cooldown) return 'cooldown' as const;
      if (row?.token) return 'busy' as const;
      rows.set(key(company, period), { token });
      return 'claimed' as const;
    },
    async save(company: string, period: string, token: string, report: any) {
      const row = rows.get(key(company, period));
      if (row?.token !== token) return null;
      const saved = { ...report, id: key(company, period) };
      rows.set(key(company, period), { report: saved });
      return saved;
    },
    async release(company: string, period: string, token: string) {
      if (rows.get(key(company, period))?.token === token) rows.set(key(company, period), { cooldown: true });
    },
    expireCooldown(company: string, period: string) { const row = rows.get(key(company, period)); if (row) row.cooldown = false; },
  };
}

test('reuses a saved preview after a new request without collecting or calling AI again', async () => {
  const store = memoryStore(); let generations = 0;
  const dependencies = { store, now: () => new Date('2026-11-05T12:00:00Z'), generate: async () => { generations++; return { period_start: '2026-11-01', is_preview: true, metrics: {}, analysis: 'Guardado', generated_at: '2026-11-05T12:00:00Z' }; } };
  const first = await getOrCreateManualGlpiPreview({} as any, 'one', dependencies as any);
  const second = await getOrCreateManualGlpiPreview({} as any, 'one', dependencies as any);
  assert.equal(first.id, second.id);
  assert.equal(second.analysis, 'Guardado');
  assert.equal(generations, 1);
  await getOrCreateManualGlpiPreview({} as any, 'two', dependencies as any);
  assert.equal(generations, 2);
});

test('concurrent requests for the same company and month run only one generation', async () => {
  const store = memoryStore(); let release: () => void = () => {}; let started: () => void = () => {};
  const ready = new Promise<void>(resolve => { started = resolve; });
  let calls = 0;
  const deps = { store, now: () => new Date('2026-11-05T12:00:00Z'), generate: async () => { calls++; started(); await new Promise<void>(resolve => { release = resolve; }); return { period_start: '2026-11-01', is_preview: true, metrics: {}, analysis: 'Guardado', generated_at: '2026-11-05T12:00:00Z' }; } };
  const first = getOrCreateManualGlpiPreview({} as any, 'one', deps as any);
  await ready;
  await assert.rejects(() => getOrCreateManualGlpiPreview({} as any, 'one', deps as any), PreviewBusyError);
  release(); await first;
  assert.equal(calls, 1);
});

test('generation failure applies a shared cooldown before a retry can call AI', async () => {
  const store = memoryStore(); let calls = 0;
  const deps = { store, now: () => new Date('2026-11-05T12:00:00Z'), generate: async () => { calls++; if (calls === 1) throw new Error('unavailable'); return { period_start: '2026-11-01', is_preview: true, metrics: {}, analysis: 'Recuperado', generated_at: '2026-11-05T12:00:00Z' }; } };
  await assert.rejects(() => getOrCreateManualGlpiPreview({} as any, 'one', deps as any), /unavailable/);
  await assert.rejects(() => getOrCreateManualGlpiPreview({} as any, 'one', deps as any), PreviewBusyError);
  assert.equal(calls, 1);
  store.expireCooldown('one', '2026-11-01');
  assert.equal((await getOrCreateManualGlpiPreview({} as any, 'one', deps as any)).analysis, 'Recuperado');
});

test('does not claim a preview is saved if persistence fails', async () => {
  const store = { ...memoryStore(), save: async () => null };
  const deps = { store, now: () => new Date('2026-11-05T12:00:00Z'), generate: async () => ({ period_start: '2026-11-01', is_preview: true, metrics: {}, analysis: 'Não salvo', generated_at: '2026-11-05T12:00:00Z' }) };
  await assert.rejects(() => getOrCreateManualGlpiPreview({} as any, 'one', deps as any), PreviewBusyError);
});

test('a later month generates a new preview instead of returning an old one', async () => {
  const store = memoryStore(); let calls = 0;
  const generate = async () => { calls++; return { period_start: calls === 1 ? '2026-11-01' : '2026-12-01', is_preview: true, metrics: {}, analysis: `Análise ${calls}`, generated_at: '2026-12-05T12:00:00Z' }; };
  await getOrCreateManualGlpiPreview({} as any, 'one', { store, now: () => new Date('2026-11-05T12:00:00Z'), generate } as any);
  const later = await getOrCreateManualGlpiPreview({} as any, 'one', { store, now: () => new Date('2026-12-05T12:00:00Z'), generate } as any);
  assert.equal(later.analysis, 'Análise 2');
  assert.equal(calls, 2);
});
