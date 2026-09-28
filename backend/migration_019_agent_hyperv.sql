-- Migration 019: agente Hyper-V como fonte operacional de servidores
-- Aditiva: preserva dados legados e não depende da pasta monitoring/ removida.

-- ============================================================
-- 1. Tokens de ativação de uso único
-- ============================================================
ALTER TABLE agent_activation_tokens
  ALTER COLUMN token DROP NOT NULL;

ALTER TABLE agent_activation_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

ALTER TABLE agent_activation_tokens
  ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS agent_activation_tokens_token_hash_idx
  ON agent_activation_tokens (token_hash)
  WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_activation_tokens_active_expiry_idx
  ON agent_activation_tokens (company_id, is_active, expires_at)
  WHERE used_at IS NULL;

-- ============================================================
-- 2. Estado do agente
-- ============================================================
ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS last_metrics_at TIMESTAMPTZ;

ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS agent_version TEXT;

ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS refresh_token_hash TEXT;

ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS machine_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS registered_agents_company_machine_idx
  ON registered_agents (company_id, machine_id)
  WHERE machine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS registered_agents_freshness_idx
  ON registered_agents (company_id, status, last_metrics_at);

-- ============================================================
-- 3. Estado atual de hosts e VMs Hyper-V
-- ============================================================
ALTER TABLE servers
  ALTER COLUMN monitoring_source SET DEFAULT 'agent_native';

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS hyperv_vm_id TEXT;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_parent_id UUID REFERENCES servers(id) ON DELETE SET NULL;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS is_virtual BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_cpu_percent DECIMAL(5,2);

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_memory_percent DECIMAL(5,2);

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_memory_total_mb INTEGER;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_memory_used_mb INTEGER;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_virtual_disk_size_gb DECIMAL(10,2);

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS vm_status TEXT;

ALTER TABLE servers
  ADD COLUMN IF NOT EXISTS last_metrics_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS servers_agent_hyperv_vm_idx
  ON servers (company_id, agent_id, hyperv_vm_id)
  WHERE agent_id IS NOT NULL AND hyperv_vm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS servers_agent_parent_idx
  ON servers (company_id, agent_id, vm_parent_id);

-- ============================================================
-- 4. Idempotência dos snapshots
-- ============================================================
ALTER TABLE agent_metrics
  ADD COLUMN IF NOT EXISTS sequence_no BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS agent_metrics_agent_sequence_idx
  ON agent_metrics (agent_id, sequence_no)
  WHERE sequence_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_metrics_retention_idx
  ON agent_metrics (collected_at);

-- ============================================================
-- 5. Ingestão atômica do lote
-- ============================================================
CREATE OR REPLACE FUNCTION ingest_agent_metrics(
  p_agent_id UUID,
  p_sequence_no BIGINT,
  p_idempotency_key TEXT,
  p_collected_at TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS TABLE (
  status TEXT,
  accepted_agent_id UUID,
  accepted_sequence_no BIGINT,
  accepted_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id UUID;
  v_host_id UUID;
  v_host JSONB;
  v_vm JSONB;
  v_hostname TEXT;
BEGIN
  SELECT company_id
    INTO v_company_id
    FROM registered_agents
   WHERE id = p_agent_id
   FOR UPDATE;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'AGENT_NOT_FOUND';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM agent_metrics
     WHERE agent_id = p_agent_id
       AND (idempotency_key = p_idempotency_key OR sequence_no = p_sequence_no)
  ) THEN
    RETURN QUERY SELECT 'duplicate', p_agent_id, p_sequence_no, NOW();
    RETURN;
  END IF;

  v_host := COALESCE(p_payload -> 'host', '{}'::jsonb);
  v_hostname := NULLIF(BTRIM(v_host ->> 'hostname'), '');

  IF v_hostname IS NULL THEN
    RAISE EXCEPTION 'INVALID_HOSTNAME';
  END IF;

  INSERT INTO agent_metrics (
    agent_id,
    company_id,
    host_cpu_percent,
    host_memory_percent,
    host_memory_total_mb,
    host_memory_used_mb,
    host_disk_percent,
    host_uptime_seconds,
    virtual_machines,
    collected_at,
    received_at,
    partial,
    idempotency_key,
    sequence_no
  )
  VALUES (
    p_agent_id,
    v_company_id,
    (v_host ->> 'cpu_percent')::DECIMAL,
    (v_host ->> 'memory_percent')::DECIMAL,
    (v_host ->> 'memory_total_mb')::INTEGER,
    (v_host ->> 'memory_used_mb')::INTEGER,
    (v_host ->> 'disk_percent')::DECIMAL,
    (v_host ->> 'uptime_seconds')::BIGINT,
    COALESCE(p_payload -> 'virtual_machines', '[]'::jsonb),
    p_collected_at,
    NOW(),
    COALESCE((p_payload ->> 'partial')::BOOLEAN, FALSE),
    p_idempotency_key,
    p_sequence_no
  );
  INSERT INTO servers (
    company_id,
    hostname,
    cpu_usage,
    memory_usage,
    disk_usage,
    memory_total,
    memory_used,
    status,
    monitoring_source,
    asset_key,
    agent_id,
    is_virtual,
    last_updated,
    last_metrics_at
  )
  VALUES (
    v_company_id,
    v_hostname,
    (v_host ->> 'cpu_percent')::DECIMAL,
    (v_host ->> 'memory_percent')::DECIMAL,
    (v_host ->> 'disk_percent')::DECIMAL,
    (v_host ->> 'memory_total_mb')::DECIMAL / 1024,
    (v_host ->> 'memory_used_mb')::DECIMAL / 1024,
    'Online',
    'agent_native',
    p_agent_id::TEXT || ':host',
    p_agent_id,
    FALSE,
    p_collected_at,
    p_collected_at
  )
  ON CONFLICT (company_id, hostname) DO UPDATE SET
    cpu_usage = EXCLUDED.cpu_usage,
    memory_usage = EXCLUDED.memory_usage,
    disk_usage = EXCLUDED.disk_usage,
    memory_total = EXCLUDED.memory_total,
    memory_used = EXCLUDED.memory_used,
    status = EXCLUDED.status,
    monitoring_source = 'agent_native',
    asset_key = EXCLUDED.asset_key,
    agent_id = EXCLUDED.agent_id,
    is_virtual = FALSE,
    last_updated = EXCLUDED.last_updated,
    last_metrics_at = EXCLUDED.last_metrics_at
  RETURNING id INTO v_host_id;

  INSERT INTO server_metric_history (
    company_id,
    server_id,
    hostname,
    cpu_usage,
    memory_usage,
    disk_usage,
    memory_total,
    memory_used,
    status,
    collected_at
  )
  VALUES (
    v_company_id,
    v_host_id,
    v_hostname,
    (v_host ->> 'cpu_percent')::DECIMAL,
    (v_host ->> 'memory_percent')::DECIMAL,
    (v_host ->> 'disk_percent')::DECIMAL,
    (v_host ->> 'memory_total_mb')::DECIMAL / 1024,
    (v_host ->> 'memory_used_mb')::DECIMAL / 1024,
    'Online',
    p_collected_at
  );

  FOR v_vm IN
    SELECT value
      FROM jsonb_array_elements(COALESCE(p_payload -> 'virtual_machines', '[]'::jsonb))
  LOOP
    INSERT INTO servers (
      company_id,
      hostname,
      cpu_usage,
      memory_usage,
      memory_total,
      memory_used,
      status,
      monitoring_source,
      asset_key,
      agent_id,
      vm_parent_id,
      hyperv_vm_id,
      is_virtual,
      vm_cpu_percent,
      vm_memory_total_mb,
      vm_memory_used_mb,
      vm_virtual_disk_size_gb,
      vm_status,
      last_updated,
      last_metrics_at
    )
    VALUES (
      v_company_id,
      v_vm ->> 'name',
      COALESCE((v_vm ->> 'cpu_percent')::DECIMAL, 0),
      CASE
        WHEN COALESCE((v_vm ->> 'memory_assigned_mb')::DECIMAL, 0) > 0
          THEN COALESCE((v_vm ->> 'memory_used_mb')::DECIMAL, 0)
            / COALESCE((v_vm ->> 'memory_assigned_mb')::DECIMAL, 1) * 100
        ELSE 0
      END,
      COALESCE((v_vm ->> 'memory_assigned_mb')::DECIMAL, 0) / 1024,
      COALESCE((v_vm ->> 'memory_used_mb')::DECIMAL, 0) / 1024,
      CASE WHEN v_vm ->> 'state' = 'Running' THEN 'Online' ELSE 'Offline' END,
      'agent_native',
      p_agent_id::TEXT || ':vm:' || (v_vm ->> 'hyperv_id'),
      p_agent_id,
      v_host_id,
      v_vm ->> 'hyperv_id',
      TRUE,
      (v_vm ->> 'cpu_percent')::DECIMAL,
      (v_vm ->> 'memory_assigned_mb')::INTEGER,
      (v_vm ->> 'memory_used_mb')::INTEGER,
      (v_vm ->> 'virtual_disk_size_gb')::DECIMAL,
      v_vm ->> 'state',
      p_collected_at,
      p_collected_at
    )
    ON CONFLICT (asset_key) DO UPDATE SET
      hostname = EXCLUDED.hostname,
      cpu_usage = EXCLUDED.cpu_usage,
      memory_usage = EXCLUDED.memory_usage,
      memory_total = EXCLUDED.memory_total,
      memory_used = EXCLUDED.memory_used,
      status = EXCLUDED.status,
      monitoring_source = 'agent_native',
      vm_parent_id = EXCLUDED.vm_parent_id,
      hyperv_vm_id = EXCLUDED.hyperv_vm_id,
      is_virtual = TRUE,
      vm_cpu_percent = EXCLUDED.vm_cpu_percent,
      vm_memory_total_mb = EXCLUDED.vm_memory_total_mb,
      vm_memory_used_mb = EXCLUDED.vm_memory_used_mb,
      vm_virtual_disk_size_gb = EXCLUDED.vm_virtual_disk_size_gb,
      vm_status = EXCLUDED.vm_status,
      last_updated = EXCLUDED.last_updated,
      last_metrics_at = EXCLUDED.last_metrics_at;
  END LOOP;

  UPDATE registered_agents
     SET status = 'Online',
         last_metrics_at = p_collected_at,
         last_error = NULL,
         updated_at = NOW()
   WHERE id = p_agent_id;

  RETURN QUERY SELECT 'accepted', p_agent_id, p_sequence_no, NOW();
END;
$$;

REVOKE ALL ON FUNCTION ingest_agent_metrics(UUID, BIGINT, TEXT, TIMESTAMPTZ, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ingest_agent_metrics(UUID, BIGINT, TEXT, TIMESTAMPTZ, JSONB) TO service_role;

-- ============================================================
-- 6. Retenção dos snapshots brutos
-- ============================================================
CREATE OR REPLACE FUNCTION purge_agent_metrics(retention_days INTEGER DEFAULT 30)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  IF retention_days < 1 THEN
    RAISE EXCEPTION 'retention_days must be positive';
  END IF;

  DELETE FROM agent_metrics
   WHERE collected_at < NOW() - make_interval(days => retention_days);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION purge_agent_metrics(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION purge_agent_metrics(INTEGER) TO service_role;
