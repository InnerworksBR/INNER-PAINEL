import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMonthlyAnalysis } from '../src/services/monthly-glpi-ai';

test('generates analysis from aggregates and accepts text beyond the first output item', async () => {
  let input: any;
  const fakeFetch: typeof fetch = async (_url, options) => {
    input = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: 'Resumo do mês.' }] }] }), { status: 200 });
  };
  const result = await generateMonthlyAnalysis({ opened: 2, solved: 1, unresolved: 3, categories: {}, priorities: {}, observedAt: '2026-11-01T11:00:00Z' }, '2026-10', { apiKey: 'test', model: 'test-model', fetcher: fakeFetch });
  assert.equal(result, 'Resumo do mês.');
  assert.equal(input.store, false);
  assert.equal(input.model, 'test-model');
  assert.match(input.input, /"opened":2/);
  assert.match(input.instructions, /não inclua recomendações/i);
  assert.match(input.instructions, /não.*saúde.*infraestrutura/i);
});

test('does not publish an empty or rejected model response', async () => {
  const metrics = { opened: 0, solved: 0, unresolved: 0, categories: {}, priorities: {}, observedAt: '' };
  await assert.rejects(() => generateMonthlyAnalysis(metrics, '2026-10', { apiKey: 'test', model: 'test', fetcher: async () => new Response('{}', { status: 200 }) }), /vazia/i);
  await assert.rejects(() => generateMonthlyAnalysis(metrics, '2026-10', { apiKey: 'test', model: 'test', fetcher: async () => new Response('{}', { status: 429 }) }), /429/);
});

test('marks an in-progress month as partial in the OpenAI request', async () => {
  let input: any;
  const metrics: any = { opened: 1, solved: 0, unresolved: 1, categories: {}, priorities: {}, observedAt: '2026-11-05T14:00:00Z' };
  await generateMonthlyAnalysis(metrics, '2026-11', { apiKey: 'test', model: 'test', partial: true, fetcher: async (_url, options) => {
    input = JSON.parse(String(options?.body));
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Prévia' }] }] }), { status: 200 });
  }});
  assert.equal(JSON.parse(input.input).partial, true);
});

test('keeps the original generated analysis for storage even when presentation filters actions', async () => {
  const metrics: any = { opened: 1, solved: 0, unresolved: 1, categories: {}, priorities: {}, observedAt: '2026-11-05T14:00:00Z' };
  const original = 'A equipe solucionou 8 chamados.\n\nAções realizadas\nO atendimento foi concluído.';
  const result = await generateMonthlyAnalysis(metrics, '2026-11', { apiKey: 'test', model: 'test', fetcher: async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: original }] }] }), { status: 200 }) });
  assert.equal(result, original);
});
