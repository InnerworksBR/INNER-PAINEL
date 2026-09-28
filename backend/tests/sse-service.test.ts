import assert from 'node:assert/strict';
import test from 'node:test';

import { formatSseEvent } from '../src/services/sse-service';

test('formata eventos SSE com JSON seguro e separador de evento', () => {
  assert.equal(
    formatSseEvent('monitoring', { servers: [{ id: 'server-1' }], sent_at: '2026-09-28T12:00:00.000Z' }),
    'event: monitoring\ndata: {"servers":[{"id":"server-1"}],"sent_at":"2026-09-28T12:00:00.000Z"}\n\n',
  );
});
