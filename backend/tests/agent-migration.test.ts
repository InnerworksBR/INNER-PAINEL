import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const migrationPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'migration_019_agent_hyperv.sql');

test('migration 019 provisions the legacy server identity required by metric ingestion', () => {
  const sql = readFileSync(migrationPath, 'utf8');

  assert.match(
    sql,
    /ALTER TABLE servers\s+ADD COLUMN IF NOT EXISTS asset_key TEXT;/i,
    'servers.asset_key must exist before the ingest function executes',
  );
  assert.match(
    sql,
    /ALTER TABLE servers\s+ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES registered_agents\(id\) ON DELETE SET NULL;/i,
    'servers.agent_id must exist before host and VM upserts',
  );
  assert.match(
    sql,
    /CREATE UNIQUE INDEX servers_asset_key_unique_idx\s+ON servers \(asset_key\);/i,
    'servers.asset_key must have a unique constraint for ON CONFLICT (asset_key)',
  );
});
