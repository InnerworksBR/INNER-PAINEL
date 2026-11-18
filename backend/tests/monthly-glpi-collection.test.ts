import assert from 'node:assert/strict';
import test from 'node:test';
import { collectTicketPages } from '../src/services/monthly-glpi-collection';

test('collects every page beyond a full first page', async () => {
  const rows = Array.from({ length: 27 }, (_, i) => ({ id: i + 1 }));
  const result = await collectTicketPages(async (start, end) => ({ data: rows.slice(start, end + 1), total: rows.length }));
  assert.equal(result.length, 27);
  assert.equal(result[26].id, 27);
});

test('rejects a truncated or repeated page rather than publishing incomplete counts', async () => {
  const page = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
  await assert.rejects(() => collectTicketPages(async () => ({ data: page, total: 100 })), /duplicad/i);
  await assert.rejects(() => collectTicketPages(async () => ({ data: page.slice(0, 3), total: 100 })), /incompleta/i);
});

test('rejects an unverified page when the total count is missing or changes', async () => {
  await assert.rejects(() => collectTicketPages(async () => ({ data: [{ id: 1 }], total: null })), /total/i);
  const page = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));
  await assert.rejects(() => collectTicketPages(async start => start === 0 ? { data: page, total: 26 } : { data: [{ id: 26 }], total: 27 }), /total/i);
});
