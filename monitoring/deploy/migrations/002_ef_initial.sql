CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;


DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
        IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'monitoring') THEN
            CREATE SCHEMA monitoring;
        END IF;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.activation_tokens (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid,
        source_type text NOT NULL,
        token_hash text NOT NULL,
        display_hint character varying(20) NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        used_at timestamp with time zone,
        revoked_at timestamp with time zone,
        created_by uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        metadata jsonb NOT NULL,
        CONSTRAINT "PK_activation_tokens" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.agent_details (
        source_id uuid NOT NULL,
        company_id uuid NOT NULL,
        os_name character varying(100) NOT NULL,
        os_version character varying(100) NOT NULL,
        os_architecture character varying(50) NOT NULL,
        hostname character varying(255) NOT NULL,
        domain character varying(255),
        boot_id character varying(100),
        boot_time timestamp with time zone,
        cpu_count integer NOT NULL,
        total_memory_bytes bigint NOT NULL,
        machine_id character varying(255),
        virtualization_role character varying(50),
        virtualization_system character varying(100),
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_agent_details" PRIMARY KEY (source_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.asset_current_state (
        asset_id uuid NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        health text NOT NULL,
        last_attempt_at timestamp with time zone,
        last_success_at timestamp with time zone,
        freshness_seconds integer,
        expected_interval_seconds integer NOT NULL,
        consecutive_failures integer NOT NULL,
        last_failure_result character varying(500),
        last_failure_code character varying(50),
        summary jsonb NOT NULL,
        computed_at timestamp with time zone NOT NULL,
        version bigint NOT NULL,
        CONSTRAINT "PK_asset_current_state" PRIMARY KEY (asset_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.asset_identifiers (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        asset_id uuid NOT NULL,
        identifier_type character varying(50) NOT NULL,
        normalized_value character varying(255) NOT NULL,
        value_hash bytea NOT NULL,
        confidence text NOT NULL,
        status text NOT NULL,
        first_seen_at timestamp with time zone NOT NULL,
        last_seen_at timestamp with time zone NOT NULL,
        source_id uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_asset_identifiers" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.asset_identity_conflicts (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        identifier_type character varying(50) NOT NULL,
        normalized_value character varying(255) NOT NULL,
        asset_id_1 uuid NOT NULL,
        asset_id_2 uuid NOT NULL,
        conflict_type character varying(50) NOT NULL,
        status character varying(50) NOT NULL,
        resolution character varying(500),
        resolved_by uuid,
        resolved_at timestamp with time zone,
        detected_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_asset_identity_conflicts" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.asset_metric_current (
        asset_id uuid NOT NULL,
        metric_id integer NOT NULL,
        dimension_hash bytea NOT NULL,
        dimensions jsonb NOT NULL,
        collected_at timestamp with time zone NOT NULL,
        received_at timestamp with time zone NOT NULL,
        value_double double precision,
        value_long bigint,
        value_boolean boolean,
        value_string text,
        quality character varying(50) NOT NULL,
        source_id uuid NOT NULL,
        batch_id uuid NOT NULL,
        CONSTRAINT "PK_asset_metric_current" PRIMARY KEY (asset_id, metric_id, dimension_hash)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.asset_source_bindings (
        asset_id uuid NOT NULL,
        source_id uuid NOT NULL,
        local_asset_id character varying(255) NOT NULL,
        role character varying(50) NOT NULL,
        first_seen_at timestamp with time zone NOT NULL,
        last_seen_at timestamp with time zone NOT NULL,
        active boolean NOT NULL,
        CONSTRAINT "PK_asset_source_bindings" PRIMARY KEY (asset_id, source_id, local_asset_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.assets (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid NOT NULL,
        asset_type character varying(50) NOT NULL,
        display_name character varying(255) NOT NULL,
        lifecycle_status character varying(50) NOT NULL,
        manufacturer character varying(100),
        model character varying(100),
        serial_number character varying(100),
        primary_ip character varying(45),
        primary_mac character varying(17),
        hostname character varying(255),
        properties jsonb NOT NULL,
        tags text[] NOT NULL,
        first_seen_at timestamp with time zone NOT NULL,
        last_seen_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_assets" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.audit_log (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        user_id uuid,
        source_id uuid,
        action character varying(100) NOT NULL,
        entity_type character varying(100) NOT NULL,
        entity_id uuid,
        old_values jsonb,
        new_values jsonb,
        ip_address character varying(45),
        user_agent character varying(500),
        correlation_id character varying(100),
        session_id character varying(100),
        timestamp timestamp with time zone NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_audit_log" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.collection_attempts (
        id uuid NOT NULL,
        source_id uuid NOT NULL,
        company_id uuid NOT NULL,
        target_asset_id uuid,
        target_ip character varying(45) NOT NULL,
        local_asset_id character varying(255),
        credential_id uuid NOT NULL,
        collection_type character varying(50) NOT NULL,
        oid character varying(500),
        started_at timestamp with time zone NOT NULL,
        completed_at timestamp with time zone,
        duration_ms bigint NOT NULL,
        result character varying(50) NOT NULL,
        error_code character varying(50),
        error_detail text,
        records_collected integer NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_collection_attempts" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.collection_profiles (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        name character varying(255) NOT NULL,
        description character varying(500) NOT NULL,
        profile_type character varying(50) NOT NULL,
        metrics jsonb NOT NULL,
        interval_seconds integer NOT NULL,
        active boolean NOT NULL,
        priority integer NOT NULL,
        created_by uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_collection_profiles" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.collector_details (
        source_id uuid NOT NULL,
        company_id uuid NOT NULL,
        collector_type character varying(50) NOT NULL,
        os_name character varying(100) NOT NULL,
        os_version character varying(100) NOT NULL,
        hostname character varying(255) NOT NULL,
        network_interface character varying(100) NOT NULL,
        primary_ip character varying(45) NOT NULL,
        snmp_timeout_ms integer NOT NULL,
        snmp_retries integer NOT NULL,
        max_concurrent_collections integer NOT NULL,
        capabilities_json jsonb NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_collector_details" PRIMARY KEY (source_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.commands (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        command_type character varying(100) NOT NULL,
        parameters jsonb,
        idempotency_key character varying(100),
        status text NOT NULL,
        priority integer NOT NULL,
        available_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        leased_at timestamp with time zone,
        lease_expires_at timestamp with time zone,
        lease_token_hash text,
        attempts integer NOT NULL,
        max_attempts integer NOT NULL,
        requested_by text,
        requested_at timestamp with time zone NOT NULL,
        started_at timestamp with time zone,
        completed_at timestamp with time zone,
        result text,
        error_code character varying(50),
        CONSTRAINT "PK_commands" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.ingest_batches (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        batch_id uuid NOT NULL,
        sequence bigint NOT NULL,
        schema_version integer NOT NULL,
        source_version character varying(50) NOT NULL,
        content_sha256 bytea NOT NULL,
        record_count integer NOT NULL,
        compressed_bytes integer NOT NULL,
        uncompressed_bytes integer NOT NULL,
        collected_from timestamp with time zone NOT NULL,
        collected_to timestamp with time zone NOT NULL,
        sent_at timestamp with time zone NOT NULL,
        received_at timestamp with time zone NOT NULL,
        payload jsonb,
        status text NOT NULL,
        processing_attempts integer NOT NULL,
        processed_at timestamp with time zone,
        last_error_code character varying(50),
        last_error_detail text,
        CONSTRAINT "PK_ingest_batches" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.metric_definitions (
        id integer GENERATED BY DEFAULT AS IDENTITY,
        metric_key character varying(100) NOT NULL,
        display_name character varying(255) NOT NULL,
        description character varying(500) NOT NULL,
        value_type character varying(50) NOT NULL,
        unit character varying(50) NOT NULL,
        semantic_type character varying(50) NOT NULL,
        aggregation character varying(50) NOT NULL,
        retention_class character varying(50) NOT NULL,
        max_dimension_sets integer NOT NULL,
        introduced_schema_version integer NOT NULL,
        active boolean NOT NULL,
        metadata jsonb NOT NULL,
        CONSTRAINT "PK_metric_definitions" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.metric_rollups_1h (
        metric_id integer NOT NULL,
        asset_id uuid NOT NULL,
        dimension_hash bytea NOT NULL,
        window_start timestamp with time zone NOT NULL,
        dimensions jsonb NOT NULL,
        window_end timestamp with time zone NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        min double precision,
        max double precision,
        avg double precision,
        sum bigint,
        count bigint,
        last double precision,
        rate double precision,
        text_value text,
        quality character varying(50) NOT NULL,
        sample_count integer NOT NULL,
        computed_at timestamp with time zone NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_metric_rollups_1h" PRIMARY KEY (metric_id, asset_id, dimension_hash, window_start)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.metric_rollups_5m (
        metric_id integer NOT NULL,
        asset_id uuid NOT NULL,
        dimension_hash bytea NOT NULL,
        window_start timestamp with time zone NOT NULL,
        dimensions jsonb NOT NULL,
        window_end timestamp with time zone NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        min double precision,
        max double precision,
        avg double precision,
        sum bigint,
        count bigint,
        last double precision,
        rate double precision,
        text_value text,
        quality character varying(50) NOT NULL,
        sample_count integer NOT NULL,
        computed_at timestamp with time zone NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_metric_rollups_5m" PRIMARY KEY (metric_id, asset_id, dimension_hash, window_start)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.metric_samples (
        collected_at timestamp with time zone NOT NULL,
        id bigint NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid NOT NULL,
        asset_id uuid NOT NULL,
        source_id uuid NOT NULL,
        metric_id integer NOT NULL,
        dimension_hash bytea NOT NULL,
        dimensions jsonb NOT NULL,
        value_double double precision,
        value_long bigint,
        value_boolean boolean,
        value_string text,
        quality character varying(50) NOT NULL,
        received_at timestamp with time zone NOT NULL,
        batch_id uuid NOT NULL,
        record_id uuid NOT NULL,
        CONSTRAINT "PK_metric_samples" PRIMARY KEY (id, collected_at)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.monitoring_events (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid,
        asset_id uuid,
        source_id uuid,
        event_type character varying(100) NOT NULL,
        severity text NOT NULL,
        title character varying(255) NOT NULL,
        message character varying(1000) NOT NULL,
        event_key character varying(255) NOT NULL,
        state text NOT NULL,
        occurred_at timestamp with time zone NOT NULL,
        resolved_at timestamp with time zone,
        payload jsonb NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_events" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.processing_jobs (
        id uuid NOT NULL,
        batch_row_id uuid NOT NULL,
        company_id uuid NOT NULL,
        source_id uuid NOT NULL,
        status text NOT NULL,
        priority integer NOT NULL,
        available_at timestamp with time zone NOT NULL,
        leased_by character varying(100),
        lease_expires_at timestamp with time zone,
        attempts integer NOT NULL,
        max_attempts integer NOT NULL,
        last_error_code character varying(50),
        last_error_detail text,
        created_at timestamp with time zone NOT NULL,
        completed_at timestamp with time zone,
        CONSTRAINT "PK_processing_jobs" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.range_credential_bindings (
        range_id uuid NOT NULL,
        credential_id uuid NOT NULL,
        company_id uuid NOT NULL,
        priority integer NOT NULL,
        status character varying(50) NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_range_credential_bindings" PRIMARY KEY (range_id, credential_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.sites (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        name character varying(255) NOT NULL,
        code character varying(50),
        timezone character varying(100) NOT NULL,
        status character varying(50) NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_sites" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.snmp_credentials (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid NOT NULL,
        name character varying(255) NOT NULL,
        version character varying(10) NOT NULL,
        security_level character varying(50),
        username character varying(100),
        auth_protocol character varying(50),
        privacy_protocol character varying(50),
        encrypted_secret text NOT NULL,
        nonce text NOT NULL,
        tag text NOT NULL,
        key_version integer NOT NULL,
        fingerprint character varying(64) NOT NULL,
        status character varying(50) NOT NULL,
        created_by uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        rotated_at timestamp with time zone,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_snmp_credentials" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.source_configurations (
        id uuid NOT NULL,
        source_id uuid NOT NULL,
        version bigint NOT NULL,
        config jsonb NOT NULL,
        config_hash bytea NOT NULL,
        status character varying(50) NOT NULL,
        created_by uuid,
        created_at timestamp with time zone NOT NULL,
        activated_at timestamp with time zone,
        CONSTRAINT "PK_source_configurations" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.source_credentials (
        id uuid NOT NULL,
        source_id uuid NOT NULL,
        family_id uuid NOT NULL,
        credential_version integer NOT NULL,
        refresh_token_hash text NOT NULL,
        issued_at timestamp with time zone NOT NULL,
        expires_at timestamp with time zone NOT NULL,
        last_used_at timestamp with time zone,
        replaced_by_id uuid,
        revoked_at timestamp with time zone,
        reuse_detected_at timestamp with time zone,
        CONSTRAINT "PK_source_credentials" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.source_heartbeats (
        id uuid NOT NULL,
        source_id uuid NOT NULL,
        company_id uuid NOT NULL,
        source_time timestamp with time zone NOT NULL,
        received_at timestamp with time zone NOT NULL,
        last_ip character varying(45),
        clock_skew_seconds integer,
        capabilities_json jsonb NOT NULL,
        health_summary_json jsonb NOT NULL,
        pending_commands integer NOT NULL,
        desired_config_version bigint NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_source_heartbeats" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.source_sequence_cursors (
        source_id uuid NOT NULL,
        highest_received_sequence bigint NOT NULL,
        highest_contiguous_sequence bigint NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_source_sequence_cursors" PRIMARY KEY (source_id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.source_sequence_gaps (
        id uuid NOT NULL,
        source_id uuid NOT NULL,
        company_id uuid NOT NULL,
        gap_start_sequence bigint NOT NULL,
        gap_end_sequence bigint NOT NULL,
        missing_count integer NOT NULL,
        status character varying(50) NOT NULL,
        filled_at timestamp with time zone,
        detected_at timestamp with time zone NOT NULL,
        created_at timestamp with time zone NOT NULL,
        CONSTRAINT "PK_source_sequence_gaps" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.sources (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid NOT NULL,
        source_type text NOT NULL,
        installation_id uuid NOT NULL,
        display_name character varying(255) NOT NULL,
        status text NOT NULL,
        platform character varying(100) NOT NULL,
        architecture character varying(50) NOT NULL,
        current_version character varying(50) NOT NULL,
        desired_version character varying(50),
        minimum_version character varying(50),
        config_version bigint NOT NULL,
        heartbeat_interval_seconds integer NOT NULL,
        last_heartbeat_at timestamp with time zone,
        last_ingest_at timestamp with time zone,
        last_ip character varying(45),
        clock_skew_seconds integer,
        capabilities_json jsonb NOT NULL,
        health_summary_json jsonb NOT NULL,
        revoked_at timestamp with time zone,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_sources" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.stream_events (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid,
        asset_id uuid,
        source_id uuid,
        stream_type character varying(50) NOT NULL,
        event_kind character varying(50) NOT NULL,
        timestamp timestamp with time zone NOT NULL,
        payload jsonb NOT NULL,
        received_at timestamp with time zone NOT NULL,
        partition_date timestamp with time zone NOT NULL,
        CONSTRAINT "PK_stream_events" PRIMARY KEY (id)
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE TABLE monitoring.network_ranges (
        id uuid NOT NULL,
        company_id uuid NOT NULL,
        site_id uuid NOT NULL,
        name character varying(255) NOT NULL,
        cidr character varying(50) NOT NULL,
        description character varying(500),
        status character varying(50) NOT NULL,
        discovery_interval_minutes integer NOT NULL,
        last_discovery_at timestamp with time zone,
        created_by uuid NOT NULL,
        created_at timestamp with time zone NOT NULL,
        updated_at timestamp with time zone NOT NULL,
        deleted_at timestamp with time zone,
        CONSTRAINT "PK_network_ranges" PRIMARY KEY (id),
        CONSTRAINT "FK_network_ranges_sites_site_id" FOREIGN KEY (site_id) REFERENCES monitoring.sites (id) ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_activation_tokens_company_id ON monitoring.activation_tokens (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_activation_tokens_expires_at ON monitoring.activation_tokens (expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_activation_tokens_token_hash ON monitoring.activation_tokens (token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_current_state_company_id ON monitoring.asset_current_state (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_current_state_health ON monitoring.asset_current_state (health);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_current_state_last_success_at ON monitoring.asset_current_state (last_success_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identifiers_asset_id ON monitoring.asset_identifiers (asset_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identifiers_company_id ON monitoring.asset_identifiers (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identifiers_type_value ON monitoring.asset_identifiers (identifier_type, normalized_value);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identifiers_value_hash ON monitoring.asset_identifiers (value_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identity_conflicts_company_id ON monitoring.asset_identity_conflicts (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_identity_conflicts_status ON monitoring.asset_identity_conflicts (status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_asset_metric_current_asset_metric ON monitoring.asset_metric_current (asset_id, metric_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_asset_type ON monitoring.assets (asset_type);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_company_id ON monitoring.assets (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_deleted_at ON monitoring.assets (deleted_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_hostname ON monitoring.assets (hostname);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_last_seen_at ON monitoring.assets (last_seen_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_lifecycle_status ON monitoring.assets (lifecycle_status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_primary_ip ON monitoring.assets (primary_ip);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_assets_site_id ON monitoring.assets (site_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_company_id ON monitoring.audit_log (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_correlation_id ON monitoring.audit_log (correlation_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_entity ON monitoring.audit_log (entity_type, entity_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_partition_date ON monitoring.audit_log (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_timestamp ON monitoring.audit_log (timestamp);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_audit_log_user_id ON monitoring.audit_log (user_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_attempts_partition_date ON monitoring.collection_attempts (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_attempts_result ON monitoring.collection_attempts (result);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_attempts_source_id ON monitoring.collection_attempts (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_attempts_started_at ON monitoring.collection_attempts (started_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_attempts_target_ip ON monitoring.collection_attempts (target_ip);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_profiles_company_id ON monitoring.collection_profiles (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_collection_profiles_type ON monitoring.collection_profiles (profile_type);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_company_id ON monitoring.commands (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_expires_at ON monitoring.commands (expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_idempotency_key ON monitoring.commands (idempotency_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_pick ON monitoring.commands (source_id, status, available_at, priority);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_source_id ON monitoring.commands (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_commands_status ON monitoring.commands (status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_ingest_batches_batch_id ON monitoring.ingest_batches (batch_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_ingest_batches_company_id ON monitoring.ingest_batches (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_ingest_batches_received_at ON monitoring.ingest_batches (received_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_ingest_batches_source_id ON monitoring.ingest_batches (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_ingest_batches_source_sequence ON monitoring.ingest_batches (source_id, sequence);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_ingest_batches_status ON monitoring.ingest_batches (status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_metric_definitions_metric_key ON monitoring.metric_definitions (metric_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_definitions_retention_class ON monitoring.metric_definitions (retention_class);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_definitions_semantic_type ON monitoring.metric_definitions (semantic_type);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_rollups_1h_asset_metric_time ON monitoring.metric_rollups_1h (asset_id, metric_id, window_start);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_rollups_1h_partition_date ON monitoring.metric_rollups_1h (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_rollups_5m_asset_metric_time ON monitoring.metric_rollups_5m (asset_id, metric_id, window_start);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_rollups_5m_partition_date ON monitoring.metric_rollups_5m (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_samples_asset_metric_time ON monitoring.metric_samples (asset_id, metric_id, collected_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_samples_batch_id ON monitoring.metric_samples (batch_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_metric_samples_company_time ON monitoring.metric_samples (company_id, collected_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_monitoring_events_asset_id ON monitoring.monitoring_events (asset_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_monitoring_events_company_id ON monitoring.monitoring_events (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_monitoring_events_event_key ON monitoring.monitoring_events (event_key);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_monitoring_events_occurred_at ON monitoring.monitoring_events (occurred_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_monitoring_events_state ON monitoring.monitoring_events (state);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_network_ranges_cidr ON monitoring.network_ranges (cidr);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_network_ranges_company_id ON monitoring.network_ranges (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_network_ranges_site_id ON monitoring.network_ranges (site_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_processing_jobs_available_at ON monitoring.processing_jobs (available_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_processing_jobs_company_id ON monitoring.processing_jobs (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_processing_jobs_lease_expires_at ON monitoring.processing_jobs (lease_expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_processing_jobs_pick ON monitoring.processing_jobs (status, available_at, priority);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_processing_jobs_status ON monitoring.processing_jobs (status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sites_company_id ON monitoring.sites (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sites_company_status ON monitoring.sites (company_id, status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sites_deleted_at ON monitoring.sites (deleted_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_snmp_credentials_company_id ON monitoring.snmp_credentials (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_snmp_credentials_fingerprint ON monitoring.snmp_credentials (fingerprint);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_snmp_credentials_site_id ON monitoring.snmp_credentials (site_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_configurations_source_id ON monitoring.source_configurations (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_configurations_source_status ON monitoring.source_configurations (source_id, status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE UNIQUE INDEX ix_source_configurations_source_version ON monitoring.source_configurations (source_id, version);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_credentials_expires_at ON monitoring.source_credentials (expires_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_credentials_family_id ON monitoring.source_credentials (family_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_credentials_refresh_token_hash ON monitoring.source_credentials (refresh_token_hash);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_credentials_source_id ON monitoring.source_credentials (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_heartbeats_partition_date ON monitoring.source_heartbeats (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_heartbeats_received_at ON monitoring.source_heartbeats (received_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_heartbeats_source_id ON monitoring.source_heartbeats (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_sequence_gaps_source_id ON monitoring.source_sequence_gaps (source_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_source_sequence_gaps_status ON monitoring.source_sequence_gaps (status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_company_id ON monitoring.sources (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_company_status ON monitoring.sources (company_id, status);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_deleted_at ON monitoring.sources (deleted_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_installation_id ON monitoring.sources (installation_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_last_heartbeat_at ON monitoring.sources (last_heartbeat_at);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_sources_site_id ON monitoring.sources (site_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_stream_events_company_id ON monitoring.stream_events (company_id);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_stream_events_partition_date ON monitoring.stream_events (partition_date);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_stream_events_stream_type ON monitoring.stream_events (stream_type);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    CREATE INDEX ix_stream_events_timestamp ON monitoring.stream_events (timestamp);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM "__EFMigrationsHistory" WHERE "MigrationId" = '20260825023046_InitialCreate') THEN
    INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
    VALUES ('20260825023046_InitialCreate', '8.0.10');
    END IF;
END $EF$;
COMMIT;

