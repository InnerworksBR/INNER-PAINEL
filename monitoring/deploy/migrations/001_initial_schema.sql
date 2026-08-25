-- Inner Monitoring - Migration 001 - Schema Inicial
-- Executar no PostgreSQL 16+

-- Criar schema
CREATE SCHEMA IF NOT EXISTS monitoring;

-- ============================================
-- Companies (referência externa - pode ser integrada com schema existente)
-- ============================================
CREATE TABLE IF NOT EXISTS monitoring.companies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id uuid NOT NULL,
    name text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'deleted')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_companies_external ON monitoring.companies (external_id);

-- ============================================
-- Sites
-- ============================================
CREATE TABLE monitoring.sites (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES monitoring.companies(id),
    name text NOT NULL,
    code text NULL,
    timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    UNIQUE (company_id, name)
);

CREATE INDEX IF NOT EXISTS ix_sites_company_status ON monitoring.sites (company_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- Activation Tokens
-- ============================================
CREATE TABLE monitoring.activation_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES monitoring.companies(id),
    site_id uuid NOT NULL REFERENCES monitoring.sites(id),
    source_type text NOT NULL CHECK (source_type IN ('agent', 'collector')),
    token_hash bytea NOT NULL,
    display_hint text NOT NULL,
    expires_at timestamptz NOT NULL,
    used_at timestamptz NULL,
    revoked_at timestamptz NULL,
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (token_hash)
);

CREATE INDEX IF NOT EXISTS ix_activation_tokens_valid ON monitoring.activation_tokens (expires_at) WHERE used_at IS NULL AND revoked_at IS NULL;

-- ============================================
-- Sources
-- ============================================
CREATE TABLE monitoring.sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES monitoring.companies(id),
    site_id uuid NOT NULL REFERENCES monitoring.sites(id),
    source_type text NOT NULL CHECK (source_type IN ('agent', 'collector')),
    installation_id uuid NOT NULL,
    display_name text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'online', 'degraded', 'offline', 'revoked', 'upgrading')
    ),
    platform text NOT NULL DEFAULT 'windows',
    architecture text NOT NULL DEFAULT 'x64',
    current_version text NOT NULL DEFAULT '0.0.0',
    desired_version text NULL,
    minimum_version text NULL,
    config_version bigint NOT NULL DEFAULT 1,
    heartbeat_interval_seconds integer NOT NULL DEFAULT 60,
    last_heartbeat_at timestamptz NULL,
    last_ingest_at timestamptz NULL,
    last_ip inet NULL,
    clock_skew_seconds integer NULL,
    capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
    health_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    revoked_at timestamptz NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    UNIQUE (company_id, installation_id)
);

CREATE INDEX IF NOT EXISTS ix_sources_company_site_status ON monitoring.sources (company_id, site_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_sources_heartbeat ON monitoring.sources (last_heartbeat_at) WHERE revoked_at IS NULL AND deleted_at IS NULL;

-- ============================================
-- Source Credentials
-- ============================================
CREATE TABLE monitoring.source_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES monitoring.sources(id),
    family_id uuid NOT NULL,
    credential_version integer NOT NULL,
    refresh_token_hash bytea NOT NULL,
    issued_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    last_used_at timestamptz NULL,
    replaced_by_id uuid NULL,
    revoked_at timestamptz NULL,
    reuse_detected_at timestamptz NULL,
    UNIQUE (source_id, credential_version),
    UNIQUE (refresh_token_hash)
);

CREATE INDEX IF NOT EXISTS ix_source_credentials_active ON monitoring.source_credentials (source_id, expires_at) WHERE revoked_at IS NULL;

-- ============================================
-- Source Configurations
-- ============================================
CREATE TABLE monitoring.source_configurations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id uuid NOT NULL REFERENCES monitoring.sources(id),
    version bigint NOT NULL,
    config jsonb NOT NULL,
    config_hash bytea NOT NULL,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'superseded', 'rejected')),
    created_by uuid NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    activated_at timestamptz NULL,
    UNIQUE (source_id, version),
    UNIQUE (source_id, config_hash)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_source_config_active ON monitoring.source_configurations (source_id) WHERE status = 'active';

-- ============================================
-- Assets
-- ============================================
CREATE TABLE monitoring.assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES monitoring.companies(id),
    site_id uuid NOT NULL REFERENCES monitoring.sites(id),
    asset_type text NOT NULL,
    display_name text NOT NULL,
    lifecycle_status text NOT NULL DEFAULT 'active' CHECK (
        lifecycle_status IN ('active', 'maintenance', 'retired', 'deleted', 'conflicted')
    ),
    manufacturer text NULL,
    model text NULL,
    serial_number text NULL,
    primary_ip inet NULL,
    primary_mac macaddr NULL,
    hostname text NULL,
    properties jsonb NOT NULL DEFAULT '{}'::jsonb,
    tags text[] NOT NULL DEFAULT '{}',
    first_seen_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS ix_assets_company_site_type ON monitoring.assets (company_id, site_id, asset_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assets_company_last_seen ON monitoring.assets (company_id, last_seen_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_assets_search ON monitoring.assets USING gin (
    to_tsvector('simple', coalesce(display_name, '') || ' ' || coalesce(hostname, '') || ' ' || coalesce(serial_number, ''))
);

-- ============================================
-- Asset Identifiers
-- ============================================
CREATE TABLE monitoring.asset_identifiers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL REFERENCES monitoring.companies(id),
    asset_id uuid NOT NULL REFERENCES monitoring.assets(id),
    identifier_type text NOT NULL,
    normalized_value text NOT NULL,
    value_hash bytea NOT NULL,
    confidence text NOT NULL DEFAULT 'strong' CHECK (confidence IN ('strong', 'medium', 'weak')),
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'conflicted', 'retired')),
    first_seen_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    source_id uuid NOT NULL REFERENCES monitoring.sources(id),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, asset_id, identifier_type, value_hash)
);

CREATE INDEX IF NOT EXISTS ix_asset_identifiers_lookup ON monitoring.asset_identifiers (company_id, identifier_type, value_hash) WHERE status = 'active';

-- ============================================
-- Asset Source Bindings
-- ============================================
CREATE TABLE monitoring.asset_source_bindings (
    asset_id uuid NOT NULL REFERENCES monitoring.assets(id),
    source_id uuid NOT NULL REFERENCES monitoring.sources(id),
    local_asset_id text NOT NULL,
    role text NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'secondary', 'discovery', 'inventory')),
    first_seen_at timestamptz NOT NULL,
    last_seen_at timestamptz NOT NULL,
    active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (asset_id, source_id),
    UNIQUE (source_id, local_asset_id)
);

-- ============================================
-- Asset Current State
-- ============================================
CREATE TABLE monitoring.asset_current_state (
    asset_id uuid PRIMARY KEY REFERENCES monitoring.assets(id),
    company_id uuid NOT NULL,
    source_id uuid NOT NULL,
    health text NOT NULL DEFAULT 'unknown' CHECK (
        health IN ('healthy', 'warning', 'stale', 'offline', 'unknown', 'maintenance')
    ),
    last_attempt_at timestamptz NULL,
    last_success_at timestamptz NULL,
    freshness_seconds integer NULL,
    expected_interval_seconds integer NOT NULL DEFAULT 60,
    consecutive_failures integer NOT NULL DEFAULT 0,
    last_failure_result text NULL,
    last_failure_code text NULL,
    summary jsonb NOT NULL DEFAULT '{}'::jsonb,
    computed_at timestamptz NOT NULL DEFAULT now(),
    version bigint NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS ix_asset_current_state_company_health ON monitoring.asset_current_state (company_id, health, last_success_at);

-- ============================================
-- Ingest Batches
-- ============================================
CREATE TABLE monitoring.ingest_batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    sequence bigint NOT NULL,
    schema_version integer NOT NULL,
    source_version text NOT NULL,
    content_sha256 bytea NOT NULL,
    record_count integer NOT NULL,
    compressed_bytes integer NOT NULL,
    uncompressed_bytes integer NOT NULL,
    collected_from timestamptz NOT NULL,
    collected_to timestamptz NOT NULL,
    sent_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL,
    status text NOT NULL DEFAULT 'received' CHECK (
        status IN ('received', 'processing', 'processed', 'retrying', 'dead_letter', 'archived')
    ),
    processing_attempts integer NOT NULL DEFAULT 0,
    processed_at timestamptz NULL,
    last_error_code text NULL,
    last_error_detail text NULL,
    UNIQUE (source_id, batch_id),
    UNIQUE (source_id, sequence)
);

CREATE INDEX IF NOT EXISTS ix_ingest_batches_status_received ON monitoring.ingest_batches (status, received_at) WHERE status IN ('received', 'retrying');
CREATE INDEX IF NOT EXISTS ix_ingest_batches_source_received ON monitoring.ingest_batches (source_id, received_at DESC);

-- ============================================
-- Processing Jobs
-- ============================================
CREATE TABLE monitoring.processing_jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_row_id uuid NOT NULL REFERENCES monitoring.ingest_batches(id),
    company_id uuid NOT NULL,
    source_id uuid NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'leased', 'retrying', 'completed', 'dead_letter')
    ),
    priority integer NOT NULL DEFAULT 100,
    available_at timestamptz NOT NULL DEFAULT now(),
    leased_by text NULL,
    lease_expires_at timestamptz NULL,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 10,
    last_error_code text NULL,
    last_error_detail text NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    completed_at timestamptz NULL,
    UNIQUE (batch_row_id)
);

CREATE INDEX IF NOT EXISTS ix_processing_jobs_claim ON monitoring.processing_jobs (priority, available_at, created_at) WHERE status IN ('pending', 'retrying');

-- ============================================
-- Metric Definitions (Catálogo)
-- ============================================
CREATE TABLE monitoring.metric_definitions (
    id serial PRIMARY KEY,
    metric_key text NOT NULL UNIQUE,
    display_name text NOT NULL,
    description text NOT NULL DEFAULT '',
    value_type text NOT NULL CHECK (
        value_type IN ('double', 'long', 'boolean', 'string')
    ),
    unit text NOT NULL DEFAULT '',
    semantic_type text NOT NULL DEFAULT 'gauge' CHECK (
        semantic_type IN ('gauge', 'counter', 'state', 'text', 'inventory')
    ),
    aggregation text NOT NULL DEFAULT 'avg' CHECK (
        aggregation IN ('avg', 'min_max_avg', 'sum', 'last', 'rate', 'none')
    ),
    retention_class text NOT NULL DEFAULT 'standard' CHECK (
        retention_class IN ('current_only', 'realtime', 'standard', 'inventory')
    ),
    max_dimension_sets integer NOT NULL DEFAULT 1000,
    introduced_schema_version integer NOT NULL DEFAULT 1,
    active boolean NOT NULL DEFAULT true,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ============================================
-- Asset Metric Current
-- ============================================
CREATE TABLE monitoring.asset_metric_current (
    asset_id uuid NOT NULL,
    metric_id integer NOT NULL,
    dimension_hash bytea NOT NULL,
    dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
    collected_at timestamptz NOT NULL,
    received_at timestamptz NOT NULL,
    value_double double precision NULL,
    value_long bigint NULL,
    value_boolean boolean NULL,
    value_string text NULL,
    quality text NOT NULL DEFAULT 'good',
    source_id uuid NOT NULL,
    batch_id uuid NOT NULL,
    PRIMARY KEY (asset_id, metric_id, dimension_hash),
    CHECK (
        (value_double IS NOT NULL)::int + (value_long IS NOT NULL)::int + (value_boolean IS NOT NULL)::int + (value_string IS NOT NULL)::int = 1
    )
);

-- ============================================
-- Metric Samples (para histórico)
-- ============================================
CREATE TABLE monitoring.metric_samples (
    collected_at timestamptz NOT NULL,
    id bigserial,
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    source_id uuid NOT NULL,
    metric_id integer NOT NULL REFERENCES monitoring.metric_definitions(id),
    dimension_hash bytea NOT NULL,
    dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
    value_double double precision NULL,
    value_long bigint NULL,
    value_boolean boolean NULL,
    value_string text NULL,
    quality text NOT NULL DEFAULT 'good',
    received_at timestamptz NOT NULL DEFAULT now(),
    batch_id uuid NOT NULL,
    record_id uuid NOT NULL,
    PRIMARY KEY (collected_at, id),
    UNIQUE (collected_at, source_id, record_id),
    CHECK (
        (value_double IS NOT NULL)::int + (value_long IS NOT NULL)::int + (value_boolean IS NOT NULL)::int + (value_string IS NOT NULL)::int = 1
    )
);

CREATE INDEX IF NOT EXISTS ix_metric_samples_asset_metric_time ON monitoring.metric_samples (asset_id, metric_id, collected_at DESC);
CREATE INDEX IF NOT EXISTS ix_metric_samples_company_time ON monitoring.metric_samples (company_id, collected_at DESC);

-- ============================================
-- Monitoring Events
-- ============================================
CREATE TABLE monitoring.monitoring_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    site_id uuid NULL,
    asset_id uuid NULL,
    source_id uuid NULL,
    event_type text NOT NULL,
    severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
    title text NOT NULL,
    message text NOT NULL,
    event_key text NOT NULL,
    state text NOT NULL DEFAULT 'open' CHECK (state IN ('open', 'acknowledged', 'resolved')),
    occurred_at timestamptz NOT NULL,
    resolved_at timestamptz NULL,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (company_id, event_key)
);

CREATE INDEX IF NOT EXISTS ix_monitoring_events_company_state_time ON monitoring.monitoring_events (company_id, state, occurred_at DESC);

-- ============================================
-- Commands
-- ============================================
CREATE TABLE monitoring.commands (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    source_id uuid NOT NULL,
    command_type text NOT NULL,
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key text NOT NULL,
    status text NOT NULL DEFAULT 'pending' CHECK (
        status IN ('pending', 'leased', 'running', 'succeeded', 'failed', 'expired', 'cancelled')
    ),
    priority integer NOT NULL DEFAULT 100,
    available_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    leased_at timestamptz NULL,
    lease_expires_at timestamptz NULL,
    lease_token_hash bytea NULL,
    attempts integer NOT NULL DEFAULT 0,
    max_attempts integer NOT NULL DEFAULT 3,
    requested_by uuid NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz NULL,
    completed_at timestamptz NULL,
    result jsonb NULL,
    error_code text NULL,
    UNIQUE (source_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS ix_commands_source_pending ON monitoring.commands (source_id, priority, available_at) WHERE status = 'pending';

-- ============================================
-- SNMP Credentials
-- ============================================
CREATE TABLE monitoring.snmp_credentials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id uuid NOT NULL,
    site_id uuid NOT NULL,
    name text NOT NULL,
    version text NOT NULL CHECK (version IN ('v2c', 'v3')),
    security_level text NULL CHECK (
        security_level IS NULL OR security_level IN ('noAuthNoPriv', 'authNoPriv', 'authPriv')
    ),
    username text NULL,
    auth_protocol text NULL,
    privacy_protocol text NULL,
    encrypted_secret bytea NOT NULL,
    nonce bytea NOT NULL,
    tag bytea NOT NULL,
    key_version integer NOT NULL DEFAULT 1,
    fingerprint text NOT NULL,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled', 'rotating')),
    created_by uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    rotated_at timestamptz NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    deleted_at timestamptz NULL,
    UNIQUE (company_id, site_id, name)
);

CREATE INDEX IF NOT EXISTS ix_snmp_credentials_scope ON monitoring.snmp_credentials (company_id, site_id, status) WHERE deleted_at IS NULL;

-- ============================================
-- Source Sequence Cursors
-- ============================================
CREATE TABLE monitoring.source_sequence_cursors (
    source_id uuid PRIMARY KEY,
    highest_received_sequence bigint NOT NULL DEFAULT 0,
    highest_contiguous_sequence bigint NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================
-- Audit Log
-- ============================================
CREATE TABLE monitoring.audit_log (
    occurred_at timestamptz NOT NULL DEFAULT now(),
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    company_id uuid NULL,
    actor_type text NOT NULL,
    actor_id text NOT NULL,
    action text NOT NULL,
    entity_type text NOT NULL,
    entity_id text NULL,
    request_id text NULL,
    correlation_id text NULL,
    source_ip inet NULL,
    before_data jsonb NULL,
    after_data jsonb NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    PRIMARY KEY (occurred_at, id)
);

CREATE INDEX IF NOT EXISTS ix_audit_log_company_time ON monitoring.audit_log (company_id, occurred_at DESC);

-- ============================================
-- Funções de trigger para updated_at
-- ============================================
CREATE OR REPLACE FUNCTION monitoring.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar triggers para updated_at nas tabelas principais
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON monitoring.companies FOR EACH ROW EXECUTE FUNCTION monitoring.update_updated_at();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON monitoring.sites FOR EACH ROW EXECUTE FUNCTION monitoring.update_updated_at();
CREATE TRIGGER update_sources_updated_at BEFORE UPDATE ON monitoring.sources FOR EACH ROW EXECUTE FUNCTION monitoring.update_updated_at();
CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON monitoring.assets FOR EACH ROW EXECUTE FUNCTION monitoring.update_updated_at();
CREATE TRIGGER update_snmp_credentials_updated_at BEFORE UPDATE ON monitoring.snmp_credentials FOR EACH ROW EXECUTE FUNCTION monitoring.update_updated_at();

-- ============================================
-- Comentários
-- ============================================
COMMENT ON SCHEMA monitoring IS 'Schema para o sistema de monitoramento Inner Monitoring';
