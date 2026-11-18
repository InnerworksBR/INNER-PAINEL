import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMonthlyEmail } from '../src/services/monthly-glpi-email';

test('email points to authenticated portal and escapes untrusted company and analysis', () => {
  const mail = buildMonthlyEmail({ company: '<Cliente>', month: '2026-10', analysis: '<script>não</script>', metrics: { opened: 2, solved: 1, unresolved: 3 }, portalUrl: 'https://portal.example' });
  assert.match(mail.html, /&lt;script&gt;/);
  assert.doesNotMatch(mail.html, /<script>/);
  assert.match(mail.text, /https:\/\/portal.example\/app\/chamados/);
  assert.match(mail.text, /2/);
});

test('client email includes factual summary without recommendations from an old saved report', () => {
  const mail = buildMonthlyEmail({ company: 'Empresa', month: '2026-10', analysis: 'Foram registrados 2 chamados.\n\nRecomendações:\nRecomendamos trocar os equipamentos.', metrics: { opened: 2, solved: 1, unresolved: 1 }, portalUrl: 'https://portal.example' });
  assert.match(mail.text, /Foram registrados 2 chamados/);
  assert.doesNotMatch(mail.text, /recomenda|trocar/i);
  assert.doesNotMatch(mail.html, /recomenda|trocar/i);
});

test('email presents a readable period and the three supported attendance indicators', () => {
  const mail = buildMonthlyEmail({ company: 'Empresa', month: '2026-10', analysis: 'O atendimento foi acompanhado durante o mês.', metrics: { opened: 7, solved: 5, unresolved: 2 }, portalUrl: 'https://portal.example' });
  assert.match(mail.html, /outubro de 2026/i);
  assert.match(mail.html, /abertos/i);
  assert.match(mail.html, /solucionados/i);
  assert.match(mail.html, /pendentes/i);
  assert.match(mail.html, /Panorama do atendimento/i);
  assert.match(mail.text, /7/);
  assert.match(mail.text, /5/);
  assert.match(mail.text, /2/);
});
