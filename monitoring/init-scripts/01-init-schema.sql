-- Script de inicialização do banco de dados
-- Executado automaticamente pelo PostgreSQL ao criar o container

-- ============================================
-- Criar schema de monitoramento
-- ============================================
CREATE SCHEMA IF NOT EXISTS monitoring;

-- ============================================
-- Criar tabelas particionadas
-- ============================================

-- Tabela de heartbeats particionada por timestamp (mensal)
CREATE TABLE IF NOT EXISTS monitoring.source_heartbeats (
    id UUID NOT NULL,
    source_id UUID NOT NULL,
    company_id UUID NOT NULL,
    received_at TIMESTAMPTZ NOT NULL,
    source_timestamp TIMESTAMPTZ NOT NULL,
    source_version VARCHAR(50),
    agent_version VARCHAR(50),
    heartbeat_interval_seconds INT,
    reported_assets_count INT,
    reported_metrics_count INT,
    queue_depth INT,
    processing_lag_ms INT,
    PRIMARY KEY (id, received_at)
) PARTITION BY RANGE (received_at);

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'source_heartbeats_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.source_heartbeats
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de collection_attempts particionada por timestamp (mensal)
CREATE TABLE IF NOT EXISTS monitoring.collection_attempts (
    id UUID NOT NULL,
    source_id UUID NOT NULL,
    company_id UUID NOT NULL,
    batch_id UUID,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ,
    duration_ms INT,
    result VARCHAR(50) NOT NULL,
    error_code VARCHAR(50),
    error_message TEXT,
    records_collected INT,
    metrics_collected INT,
    assets_discovered INT,
    PRIMARY KEY (id, started_at)
) PARTITION BY RANGE (started_at);

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'collection_attempts_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.collection_attempts
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de metric_samples particionada por timestamp (hora)
CREATE TABLE IF NOT EXISTS monitoring.metric_samples (
    id UUID NOT NULL,
    company_id UUID NOT NULL,
    source_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    metric_id INT NOT NULL,
    observed_at TIMESTAMPTZ NOT NULL,
    value_double DOUBLE PRECISION,
    value_long BIGINT,
    value_boolean BOOLEAN,
    value_string TEXT,
    unit VARCHAR(50),
    quality VARCHAR(20),
    dimension_hash BYTEA,
    dimensions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Criar partições para os próximos 7 dias (granularidade hora)
DO $$
DECLARE
    start_date TIMESTAMPTZ := CURRENT_TIMESTAMP;
    end_date TIMESTAMPTZ;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..167 LOOP -- 168 horas = 7 dias
        end_date := start_date + INTERVAL '1 hour';
        partition_name := 'metric_samples_h' || TO_CHAR(start_date, 'YYYYMMDDHH24');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.metric_samples
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de metric_rollups_5m particionada por timestamp (diário)
CREATE TABLE IF NOT EXISTS monitoring.metric_rollups_5m (
    id UUID NOT NULL,
    company_id UUID NOT NULL,
    source_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    metric_id INT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    sample_count INT NOT NULL,
    value_min DOUBLE PRECISION,
    value_max DOUBLE PRECISION,
    value_avg DOUBLE PRECISION,
    value_sum DOUBLE PRECISION,
    value_last DOUBLE PRECISION,
    unit VARCHAR(50),
    dimension_hash BYTEA,
    dimensions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, period_start)
) PARTITION BY RANGE (period_start);

-- Criar partições para os próximos 90 dias
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..89 LOOP
        end_date := start_date + 1;
        partition_name := 'metric_rollups_5m_d' || TO_CHAR(start_date, 'YYYYMMDD');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.metric_rollups_5m
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de metric_rollups_1h particionada por timestamp (mensal)
CREATE TABLE IF NOT EXISTS monitoring.metric_rollups_1h (
    id UUID NOT NULL,
    company_id UUID NOT NULL,
    source_id UUID NOT NULL,
    asset_id UUID NOT NULL,
    metric_id INT NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    sample_count INT NOT NULL,
    value_min DOUBLE PRECISION,
    value_max DOUBLE PRECISION,
    value_avg DOUBLE PRECISION,
    value_sum DOUBLE PRECISION,
    value_last DOUBLE PRECISION,
    unit VARCHAR(50),
    dimension_hash BYTEA,
    dimensions JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, period_start)
) PARTITION BY RANGE (period_start);

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'metric_rollups_1h_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.metric_rollups_1h
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de stream_events particionada por timestamp (mensal)
CREATE TABLE IF NOT EXISTS monitoring.stream_events (
    id UUID NOT NULL,
    company_id UUID NOT NULL,
    source_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    asset_id UUID,
    metric_id INT,
    observed_at TIMESTAMPTZ NOT NULL,
    payload JSONB,
    correlation_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, observed_at)
) PARTITION BY RANGE (observed_at);

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'stream_events_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.stream_events
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- Tabela de audit_log particionada por timestamp (mensal)
CREATE TABLE IF NOT EXISTS monitoring.audit_log (
    id UUID NOT NULL,
    company_id UUID NOT NULL,
    user_id UUID,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    correlation_id VARCHAR(100),
    occurred_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Criar partições para os próximos 12 meses
DO $$
DECLARE
    start_date DATE := CURRENT_DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 0..11 LOOP
        end_date := start_date + INTERVAL '1 month';
        partition_name := 'audit_log_' || TO_CHAR(start_date, 'YYYY_MM');

        EXECUTE FORMAT(
            'CREATE TABLE IF NOT EXISTS monitoring.%I PARTITION OF monitoring.audit_log
             FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            start_date,
            end_date
        );

        start_date := end_date;
    END LOOP;
END $$;

-- ============================================
-- Criar índices globais
-- ============================================

-- Índices para source_heartbeats
CREATE INDEX IF NOT EXISTS ix_source_heartbeats_source_id ON monitoring.source_heartbeats (source_id);
CREATE INDEX IF NOT EXISTS ix_source_heartbeats_company_id ON monitoring.source_heartbeats (company_id);

-- Índices para collection_attempts
CREATE INDEX IF NOT EXISTS ix_collection_attempts_source_id ON monitoring.collection_attempts (source_id);
CREATE INDEX IF NOT EXISTS ix_collection_attempts_result ON monitoring.collection_attempts (result);

-- Índices para metric_samples
CREATE INDEX IF NOT EXISTS ix_metric_samples_asset_metric ON monitoring.metric_samples (asset_id, metric_id);
CREATE INDEX IF NOT EXISTS ix_metric_samples_company_time ON monitoring.metric_samples (company_id, observed_at);

-- Índices para stream_events
CREATE INDEX IF NOT EXISTS ix_stream_events_type ON monitoring.stream_events (event_type);
CREATE INDEX IF NOT EXISTS ix_stream_events_asset ON monitoring.stream_events (asset_id);

-- Índices para audit_log
CREATE INDEX IF NOT EXISTS ix_audit_log_user ON monitoring.audit_log (user_id);
CREATE INDEX IF NOT EXISTS ix_audit_log_entity ON monitoring.audit_log (entity_type, entity_id);

-- ============================================
-- Comentários
-- ============================================

COMMENT ON SCHEMA monitoring IS 'Schema para dados de monitoramento da plataforma Inner';
COMMENT ON TABLE monitoring.source_heartbeats IS 'Heartbeats recebidos das fontes de dados - particionado por mes';
COMMENT ON TABLE monitoring.collection_attempts IS 'Tentativas de coleta de metricas - particionado por mes';
COMMENT ON TABLE monitoring.metric_samples IS 'Samples individuais de metricas - particionado por hora';
COMMENT ON TABLE monitoring.metric_rollups_5m IS 'Agregados de 5 minutos - particionado por dia';
COMMENT ON TABLE monitoring.metric_rollups_1h IS 'Agregados de 1 hora - particionado por mes';
COMMENT ON TABLE monitoring.stream_events IS 'Eventos de stream em tempo real - particionado por mes';
COMMENT ON TABLE monitoring.audit_log IS 'Log de auditoria de acoes - particionado por mes';

-- ============================================
-- Grants (opcional, para futuras integracoes)
-- ============================================

-- GRANT USAGE ON SCHEMA monitoring TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA monitoring TO app_user;
