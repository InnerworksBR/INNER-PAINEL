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
