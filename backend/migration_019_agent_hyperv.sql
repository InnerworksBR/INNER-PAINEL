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

ALTER TABLE registered_agents
  ADD COLUMN IF NOT EXISTS last_sequence_no BIGINT NOT NULL DEFAULT -1;

CREATE UNIQUE INDEX IF NOT EXISTS registered_agents_company_machine_idx
  ON registered_agents (company_id, machine_id)
  WHERE machine_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS registered_agents_freshness_idx
  ON registered_agents (company_id, status, last_metrics_at);

-- Enrollment atômico: bloqueia e consome o token junto com o upsert do agente.
CREATE OR REPLACE FUNCTION enroll_agent(
  p_activation_token_hash TEXT,
  p_machine_id TEXT,
  p_hostname TEXT,
  p_agent_version TEXT,
  p_os_info TEXT,
  p_os_version TEXT,
  p_hypervisor TEXT,
  p_refresh_token_hash TEXT,
  p_agent_secret_hash TEXT
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  hostname TEXT,
  agent_version TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token_id UUID;
  v_company_id UUID;
  v_asset_key TEXT;
BEGIN
  SELECT id, company_id
    INTO v_token_id, v_company_id
    FROM agent_activation_tokens
   WHERE token_hash = p_activation_token_hash
     AND is_active = TRUE
     AND used_at IS NULL
     AND (expires_at IS NULL OR expires_at > NOW())
   FOR UPDATE;

  IF v_token_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ACTIVATION_TOKEN';
  END IF;

  v_asset_key := 'agent:' || v_company_id::TEXT || ':' || BTRIM(p_machine_id);

  UPDATE agent_activation_tokens
     SET used_at = NOW(), is_active = FALSE
   WHERE id = v_token_id;

  RETURN QUERY
  INSERT INTO registered_agents (
    company_id,
    agent_type,
    asset_key,
    agent_secret,
    refresh_token_hash,
    machine_id,
    hostname,
    os_info,
    os_version,
    hypervisor,
    version,
    agent_version,
    status,
    last_heartbeat,
    metadata
  )
  VALUES (
    v_company_id,
    'endpoint',
    v_asset_key,
    p_agent_secret_hash,
    p_refresh_token_hash,
    BTRIM(p_machine_id),
    BTRIM(p_hostname),
    NULLIF(BTRIM(p_os_info), ''),
    NULLIF(BTRIM(p_os_version), ''),
    COALESCE(NULLIF(BTRIM(p_hypervisor), ''), 'Hyper-V'),
    BTRIM(p_agent_version),
    BTRIM(p_agent_version),
    'Online',
    NOW(),
    jsonb_build_object('enrollment', 'native-agent-v1')
  )
  ON CONFLICT (asset_key) DO UPDATE SET
    agent_secret = EXCLUDED.agent_secret,
    refresh_token_hash = EXCLUDED.refresh_token_hash,
    machine_id = EXCLUDED.machine_id,
    hostname = EXCLUDED.hostname,
    os_info = EXCLUDED.os_info,
    os_version = EXCLUDED.os_version,
    hypervisor = EXCLUDED.hypervisor,
    version = EXCLUDED.version,
    agent_version = EXCLUDED.agent_version,
    status = 'Online',
    last_heartbeat = NOW(),
    last_error = NULL,
    metadata = EXCLUDED.metadata,
    updated_at = NOW()
  RETURNING registered_agents.id, registered_agents.company_id, registered_agents.hostname, registered_agents.agent_version;
END;
$$;

REVOKE ALL ON FUNCTION enroll_agent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enroll_agent(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

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
  v_agent_status TEXT;
  v_last_sequence_no BIGINT;
  v_host_id UUID;
  v_host JSONB;
  v_vm JSONB;
  v_hostname TEXT;
  v_previous_status TEXT;
  v_current_status TEXT;
BEGIN
  SELECT company_id, status, COALESCE(last_sequence_no, -1)
    INTO v_company_id, v_agent_status, v_last_sequence_no
    FROM registered_agents
   WHERE id = p_agent_id
   FOR UPDATE;

  IF v_company_id IS NULL OR v_agent_status = 'Revoked' THEN
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

  IF p_sequence_no <= v_last_sequence_no THEN
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
  -- O host é identificado pelo agente/asset_key; hostname é apenas mutável.
  SELECT id
    INTO v_host_id
    FROM servers
   WHERE company_id = v_company_id
     AND (
       asset_key = p_agent_id::TEXT || ':host'
       OR (agent_id = p_agent_id AND is_virtual = FALSE)
       OR (hostname = v_hostname AND agent_id IS NULL)
     )
   ORDER BY CASE WHEN asset_key = p_agent_id::TEXT || ':host' THEN 0 ELSE 1 END
   LIMIT 1
   FOR UPDATE;

  IF v_host_id IS NULL THEN
    INSERT INTO servers (
      company_id, hostname, cpu_usage, memory_usage, disk_usage,
      memory_total, memory_used, status, monitoring_source, asset_key,
      agent_id, is_virtual, last_updated, last_metrics_at
    )
    VALUES (
      v_company_id, v_hostname,
      (v_host ->> 'cpu_percent')::DECIMAL,
      (v_host ->> 'memory_percent')::DECIMAL,
      (v_host ->> 'disk_percent')::DECIMAL,
      (v_host ->> 'memory_total_mb')::DECIMAL / 1024,
      (v_host ->> 'memory_used_mb')::DECIMAL / 1024,
      'Online', 'agent_native', p_agent_id::TEXT || ':host',
      p_agent_id, FALSE, p_collected_at, p_collected_at
    )
    RETURNING id INTO v_host_id;
  ELSE
    UPDATE servers
       SET hostname = v_hostname,
           cpu_usage = (v_host ->> 'cpu_percent')::DECIMAL,
           memory_usage = (v_host ->> 'memory_percent')::DECIMAL,
           disk_usage = (v_host ->> 'disk_percent')::DECIMAL,
           memory_total = (v_host ->> 'memory_total_mb')::DECIMAL / 1024,
           memory_used = (v_host ->> 'memory_used_mb')::DECIMAL / 1024,
           status = 'Online',
           monitoring_source = 'agent_native',
           asset_key = p_agent_id::TEXT || ':host',
           agent_id = p_agent_id,
           is_virtual = FALSE,
           last_updated = p_collected_at,
           last_metrics_at = p_collected_at
     WHERE id = v_host_id;
  END IF;

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
    v_current_status := CASE WHEN v_vm ->> 'state' = 'Running' THEN 'Online' ELSE 'Offline' END;
    SELECT status
      INTO v_previous_status
      FROM servers
     WHERE asset_key = p_agent_id::TEXT || ':vm:' || (v_vm ->> 'hyperv_id')
     FOR UPDATE;

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
      v_current_status,
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

    IF v_previous_status IS DISTINCT FROM v_current_status THEN
      INSERT INTO monitoring_events (
        company_id, source, entity_name, entity_type, previous_status,
        current_status, severity, message, metadata
      )
      VALUES (
        v_company_id,
        'server',
        v_vm ->> 'name',
        'virtual_machine',
        v_previous_status,
        v_current_status,
        CASE WHEN v_current_status = 'Offline' THEN 'warning' ELSE 'info' END,
        CASE
          WHEN v_previous_status IS NULL THEN 'Máquina virtual descoberta pelo agente Hyper-V.'
          ELSE 'Estado da máquina virtual alterado pelo agente Hyper-V.'
        END,
        jsonb_build_object(
          'agent_id', p_agent_id,
          'hyperv_id', v_vm ->> 'hyperv_id',
          'sequence_no', p_sequence_no
        )
      );
    END IF;
  END LOOP;

  -- Uma VM ausente do snapshot atual foi removida/desligada e não pode ficar online.
  FOR v_vm IN
    SELECT jsonb_build_object(
      'name', s.hostname,
      'status', s.status,
      'hyperv_id', s.hyperv_vm_id
    )
      FROM servers s
     WHERE s.company_id = v_company_id
       AND s.agent_id = p_agent_id
       AND s.is_virtual = TRUE
       AND s.last_metrics_at < p_collected_at
       AND NOT EXISTS (
         SELECT 1
           FROM jsonb_array_elements(COALESCE(p_payload -> 'virtual_machines', '[]'::jsonb)) incoming
          WHERE incoming ->> 'hyperv_id' = s.hyperv_vm_id
       )
     FOR UPDATE
  LOOP
    UPDATE servers
       SET status = 'Offline',
           vm_status = 'Off',
           last_updated = p_collected_at,
           last_metrics_at = p_collected_at
     WHERE asset_key = p_agent_id::TEXT || ':vm:' || (v_vm ->> 'hyperv_id');

    IF v_vm ->> 'status' <> 'Offline' THEN
      INSERT INTO monitoring_events (
        company_id, source, entity_name, entity_type, previous_status,
        current_status, severity, message, metadata
      )
      VALUES (
        v_company_id,
        'server',
        v_vm ->> 'name',
        'virtual_machine',
        v_vm ->> 'status',
        'Offline',
        'warning',
        'Máquina virtual ausente no snapshot do agente Hyper-V.',
        jsonb_build_object(
          'agent_id', p_agent_id,
          'hyperv_id', v_vm ->> 'hyperv_id',
          'sequence_no', p_sequence_no
        )
      );
    END IF;
  END LOOP;

  UPDATE registered_agents
     SET status = 'Online',
         last_metrics_at = p_collected_at,
         last_sequence_no = p_sequence_no,
         last_error = NULL,
         updated_at = NOW()
   WHERE id = p_agent_id
     AND status <> 'Revoked';

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
