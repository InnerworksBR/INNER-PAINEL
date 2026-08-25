using System;
using System.Collections.Generic;
using System.Text.Json;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Inner.Monitoring.Infrastructure.Postgres.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "monitoring");

            migrationBuilder.CreateTable(
                name: "activation_tokens",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_type = table.Column<string>(type: "text", nullable: false),
                    token_hash = table.Column<string>(type: "text", nullable: false),
                    display_hint = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    metadata = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_activation_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "agent_details",
                schema: "monitoring",
                columns: table => new
                {
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    os_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    os_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    os_architecture = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    hostname = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    domain = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    boot_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    boot_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    cpu_count = table.Column<int>(type: "integer", nullable: false),
                    total_memory_bytes = table.Column<long>(type: "bigint", nullable: false),
                    machine_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    virtualization_role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    virtualization_system = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_agent_details", x => x.source_id);
                });

            migrationBuilder.CreateTable(
                name: "asset_current_state",
                schema: "monitoring",
                columns: table => new
                {
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    health = table.Column<string>(type: "text", nullable: false),
                    last_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_success_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    freshness_seconds = table.Column<int>(type: "integer", nullable: true),
                    expected_interval_seconds = table.Column<int>(type: "integer", nullable: false),
                    consecutive_failures = table.Column<int>(type: "integer", nullable: false),
                    last_failure_result = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    last_failure_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    summary = table.Column<string>(type: "jsonb", nullable: false),
                    computed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_current_state", x => x.asset_id);
                });

            migrationBuilder.CreateTable(
                name: "asset_identifiers",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    identifier_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    normalized_value = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    value_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    confidence = table.Column<string>(type: "text", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_identifiers", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "asset_identity_conflicts",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    identifier_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    normalized_value = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    asset_id_1 = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id_2 = table.Column<Guid>(type: "uuid", nullable: false),
                    conflict_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    resolution = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    resolved_by = table.Column<Guid>(type: "uuid", nullable: true),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_identity_conflicts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "asset_metric_current",
                schema: "monitoring",
                columns: table => new
                {
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    metric_id = table.Column<int>(type: "integer", nullable: false),
                    dimension_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    dimensions = table.Column<string>(type: "jsonb", nullable: false),
                    collected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    value_double = table.Column<double>(type: "double precision", nullable: true),
                    value_long = table.Column<long>(type: "bigint", nullable: true),
                    value_boolean = table.Column<bool>(type: "boolean", nullable: true),
                    value_string = table.Column<string>(type: "text", nullable: true),
                    quality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_metric_current", x => new { x.asset_id, x.metric_id, x.dimension_hash });
                });

            migrationBuilder.CreateTable(
                name: "asset_source_bindings",
                schema: "monitoring",
                columns: table => new
                {
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    local_asset_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    role = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_asset_source_bindings", x => new { x.asset_id, x.source_id, x.local_asset_id });
                });

            migrationBuilder.CreateTable(
                name: "assets",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    lifecycle_status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    manufacturer = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    model = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    serial_number = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    primary_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    primary_mac = table.Column<string>(type: "character varying(17)", maxLength: 17, nullable: true),
                    hostname = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    properties = table.Column<string>(type: "jsonb", nullable: false),
                    tags = table.Column<List<string>>(type: "text[]", nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_assets", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    action = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    entity_id = table.Column<Guid>(type: "uuid", nullable: true),
                    old_values = table.Column<string>(type: "jsonb", nullable: true),
                    new_values = table.Column<string>(type: "jsonb", nullable: true),
                    ip_address = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    user_agent = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    correlation_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    session_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "collection_attempts",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    target_asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    local_asset_id = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: true),
                    credential_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collection_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    oid = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    duration_ms = table.Column<long>(type: "bigint", nullable: false),
                    result = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    error_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    error_detail = table.Column<string>(type: "text", nullable: true),
                    records_collected = table.Column<int>(type: "integer", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collection_attempts", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "collection_profiles",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    profile_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    metrics = table.Column<string>(type: "jsonb", nullable: false),
                    interval_seconds = table.Column<int>(type: "integer", nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collection_profiles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "collector_details",
                schema: "monitoring",
                columns: table => new
                {
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    collector_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    os_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    os_version = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    hostname = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    network_interface = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    primary_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: false),
                    snmp_timeout_ms = table.Column<int>(type: "integer", nullable: false),
                    snmp_retries = table.Column<int>(type: "integer", nullable: false),
                    max_concurrent_collections = table.Column<int>(type: "integer", nullable: false),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_collector_details", x => x.source_id);
                });

            migrationBuilder.CreateTable(
                name: "commands",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    command_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    parameters = table.Column<string>(type: "jsonb", nullable: true),
                    idempotency_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    available_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    leased_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    lease_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    lease_token_hash = table.Column<string>(type: "text", nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    max_attempts = table.Column<int>(type: "integer", nullable: false),
                    requested_by = table.Column<string>(type: "text", nullable: true),
                    requested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    result = table.Column<string>(type: "text", nullable: true),
                    error_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_commands", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ingest_batches",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    sequence = table.Column<long>(type: "bigint", nullable: false),
                    schema_version = table.Column<int>(type: "integer", nullable: false),
                    source_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    content_sha256 = table.Column<byte[]>(type: "bytea", nullable: false),
                    record_count = table.Column<int>(type: "integer", nullable: false),
                    compressed_bytes = table.Column<int>(type: "integer", nullable: false),
                    uncompressed_bytes = table.Column<int>(type: "integer", nullable: false),
                    collected_from = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    collected_to = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    sent_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    payload = table.Column<JsonDocument>(type: "jsonb", nullable: true),
                    status = table.Column<string>(type: "text", nullable: false),
                    processing_attempts = table.Column<int>(type: "integer", nullable: false),
                    processed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_error_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    last_error_detail = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ingest_batches", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "metric_definitions",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    metric_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    value_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    unit = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    semantic_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    aggregation = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    retention_class = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    max_dimension_sets = table.Column<int>(type: "integer", nullable: false),
                    introduced_schema_version = table.Column<int>(type: "integer", nullable: false),
                    active = table.Column<bool>(type: "boolean", nullable: false),
                    metadata = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_metric_definitions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "metric_rollups_1h",
                schema: "monitoring",
                columns: table => new
                {
                    metric_id = table.Column<int>(type: "integer", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dimension_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    window_start = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    dimensions = table.Column<string>(type: "jsonb", nullable: false),
                    window_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    min = table.Column<double>(type: "double precision", nullable: true),
                    max = table.Column<double>(type: "double precision", nullable: true),
                    avg = table.Column<double>(type: "double precision", nullable: true),
                    sum = table.Column<long>(type: "bigint", nullable: true),
                    count = table.Column<long>(type: "bigint", nullable: true),
                    last = table.Column<double>(type: "double precision", nullable: true),
                    rate = table.Column<double>(type: "double precision", nullable: true),
                    text_value = table.Column<string>(type: "text", nullable: true),
                    quality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sample_count = table.Column<int>(type: "integer", nullable: false),
                    computed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_metric_rollups_1h", x => new { x.metric_id, x.asset_id, x.dimension_hash, x.window_start });
                });

            migrationBuilder.CreateTable(
                name: "metric_rollups_5m",
                schema: "monitoring",
                columns: table => new
                {
                    metric_id = table.Column<int>(type: "integer", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    dimension_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    window_start = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    dimensions = table.Column<string>(type: "jsonb", nullable: false),
                    window_end = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    min = table.Column<double>(type: "double precision", nullable: true),
                    max = table.Column<double>(type: "double precision", nullable: true),
                    avg = table.Column<double>(type: "double precision", nullable: true),
                    sum = table.Column<long>(type: "bigint", nullable: true),
                    count = table.Column<long>(type: "bigint", nullable: true),
                    last = table.Column<double>(type: "double precision", nullable: true),
                    rate = table.Column<double>(type: "double precision", nullable: true),
                    text_value = table.Column<string>(type: "text", nullable: true),
                    quality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    sample_count = table.Column<int>(type: "integer", nullable: false),
                    computed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_metric_rollups_5m", x => new { x.metric_id, x.asset_id, x.dimension_hash, x.window_start });
                });

            migrationBuilder.CreateTable(
                name: "metric_samples",
                schema: "monitoring",
                columns: table => new
                {
                    collected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    id = table.Column<long>(type: "bigint", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    metric_id = table.Column<int>(type: "integer", nullable: false),
                    dimension_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    dimensions = table.Column<string>(type: "jsonb", nullable: false),
                    value_double = table.Column<double>(type: "double precision", nullable: true),
                    value_long = table.Column<long>(type: "bigint", nullable: true),
                    value_boolean = table.Column<bool>(type: "boolean", nullable: true),
                    value_string = table.Column<string>(type: "text", nullable: true),
                    quality = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    batch_id = table.Column<Guid>(type: "uuid", nullable: false),
                    record_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_metric_samples", x => new { x.id, x.collected_at });
                });

            migrationBuilder.CreateTable(
                name: "monitoring_events",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    event_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    severity = table.Column<string>(type: "text", nullable: false),
                    title = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    message = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    event_key = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    state = table.Column<string>(type: "text", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_monitoring_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "processing_jobs",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    batch_row_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    available_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    leased_by = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    lease_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    max_attempts = table.Column<int>(type: "integer", nullable: false),
                    last_error_code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    last_error_detail = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_processing_jobs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "range_credential_bindings",
                schema: "monitoring",
                columns: table => new
                {
                    range_id = table.Column<Guid>(type: "uuid", nullable: false),
                    credential_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    priority = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_range_credential_bindings", x => new { x.range_id, x.credential_id });
                });

            migrationBuilder.CreateTable(
                name: "sites",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    code = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    timezone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sites", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "snmp_credentials",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    version = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    security_level = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    username = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    auth_protocol = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    privacy_protocol = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    encrypted_secret = table.Column<string>(type: "text", nullable: false),
                    nonce = table.Column<string>(type: "text", nullable: false),
                    tag = table.Column<string>(type: "text", nullable: false),
                    key_version = table.Column<int>(type: "integer", nullable: false),
                    fingerprint = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    rotated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_snmp_credentials", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "source_configurations",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    config = table.Column<string>(type: "jsonb", nullable: false),
                    config_hash = table.Column<byte[]>(type: "bytea", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    created_by = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    activated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_configurations", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "source_credentials",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    family_id = table.Column<Guid>(type: "uuid", nullable: false),
                    credential_version = table.Column<int>(type: "integer", nullable: false),
                    refresh_token_hash = table.Column<string>(type: "text", nullable: false),
                    issued_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_used_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    replaced_by_id = table.Column<Guid>(type: "uuid", nullable: true),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reuse_detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_credentials", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "source_heartbeats",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_time = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    clock_skew_seconds = table.Column<int>(type: "integer", nullable: true),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: false),
                    health_summary_json = table.Column<string>(type: "jsonb", nullable: false),
                    pending_commands = table.Column<int>(type: "integer", nullable: false),
                    desired_config_version = table.Column<long>(type: "bigint", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_heartbeats", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "source_sequence_cursors",
                schema: "monitoring",
                columns: table => new
                {
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    highest_received_sequence = table.Column<long>(type: "bigint", nullable: false),
                    highest_contiguous_sequence = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_sequence_cursors", x => x.source_id);
                });

            migrationBuilder.CreateTable(
                name: "source_sequence_gaps",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    gap_start_sequence = table.Column<long>(type: "bigint", nullable: false),
                    gap_end_sequence = table.Column<long>(type: "bigint", nullable: false),
                    missing_count = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    filled_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    detected_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_source_sequence_gaps", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "sources",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_type = table.Column<string>(type: "text", nullable: false),
                    installation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    display_name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    platform = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    architecture = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    current_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    desired_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    minimum_version = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: true),
                    config_version = table.Column<long>(type: "bigint", nullable: false),
                    heartbeat_interval_seconds = table.Column<int>(type: "integer", nullable: false),
                    last_heartbeat_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_ingest_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_ip = table.Column<string>(type: "character varying(45)", maxLength: 45, nullable: true),
                    clock_skew_seconds = table.Column<int>(type: "integer", nullable: true),
                    capabilities_json = table.Column<string>(type: "jsonb", nullable: false),
                    health_summary_json = table.Column<string>(type: "jsonb", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sources", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "stream_events",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    asset_id = table.Column<Guid>(type: "uuid", nullable: true),
                    source_id = table.Column<Guid>(type: "uuid", nullable: true),
                    stream_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    event_kind = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    timestamp = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    payload = table.Column<string>(type: "jsonb", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    partition_date = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_stream_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "network_ranges",
                schema: "monitoring",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    company_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    cidr = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    discovery_interval_minutes = table.Column<int>(type: "integer", nullable: false),
                    last_discovery_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    created_by = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    deleted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_network_ranges", x => x.id);
                    table.ForeignKey(
                        name: "FK_network_ranges_sites_site_id",
                        column: x => x.site_id,
                        principalSchema: "monitoring",
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_activation_tokens_company_id",
                schema: "monitoring",
                table: "activation_tokens",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_activation_tokens_expires_at",
                schema: "monitoring",
                table: "activation_tokens",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_activation_tokens_token_hash",
                schema: "monitoring",
                table: "activation_tokens",
                column: "token_hash");

            migrationBuilder.CreateIndex(
                name: "ix_asset_current_state_company_id",
                schema: "monitoring",
                table: "asset_current_state",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_asset_current_state_health",
                schema: "monitoring",
                table: "asset_current_state",
                column: "health");

            migrationBuilder.CreateIndex(
                name: "ix_asset_current_state_last_success_at",
                schema: "monitoring",
                table: "asset_current_state",
                column: "last_success_at");

            migrationBuilder.CreateIndex(
                name: "ix_asset_identifiers_asset_id",
                schema: "monitoring",
                table: "asset_identifiers",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_asset_identifiers_company_id",
                schema: "monitoring",
                table: "asset_identifiers",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_asset_identifiers_type_value",
                schema: "monitoring",
                table: "asset_identifiers",
                columns: new[] { "identifier_type", "normalized_value" });

            migrationBuilder.CreateIndex(
                name: "ix_asset_identifiers_value_hash",
                schema: "monitoring",
                table: "asset_identifiers",
                column: "value_hash");

            migrationBuilder.CreateIndex(
                name: "ix_asset_identity_conflicts_company_id",
                schema: "monitoring",
                table: "asset_identity_conflicts",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_asset_identity_conflicts_status",
                schema: "monitoring",
                table: "asset_identity_conflicts",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_asset_metric_current_asset_metric",
                schema: "monitoring",
                table: "asset_metric_current",
                columns: new[] { "asset_id", "metric_id" });

            migrationBuilder.CreateIndex(
                name: "ix_assets_asset_type",
                schema: "monitoring",
                table: "assets",
                column: "asset_type");

            migrationBuilder.CreateIndex(
                name: "ix_assets_company_id",
                schema: "monitoring",
                table: "assets",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_assets_deleted_at",
                schema: "monitoring",
                table: "assets",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "ix_assets_hostname",
                schema: "monitoring",
                table: "assets",
                column: "hostname");

            migrationBuilder.CreateIndex(
                name: "ix_assets_last_seen_at",
                schema: "monitoring",
                table: "assets",
                column: "last_seen_at");

            migrationBuilder.CreateIndex(
                name: "ix_assets_lifecycle_status",
                schema: "monitoring",
                table: "assets",
                column: "lifecycle_status");

            migrationBuilder.CreateIndex(
                name: "ix_assets_primary_ip",
                schema: "monitoring",
                table: "assets",
                column: "primary_ip");

            migrationBuilder.CreateIndex(
                name: "ix_assets_site_id",
                schema: "monitoring",
                table: "assets",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_company_id",
                schema: "monitoring",
                table: "audit_log",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_correlation_id",
                schema: "monitoring",
                table: "audit_log",
                column: "correlation_id");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_entity",
                schema: "monitoring",
                table: "audit_log",
                columns: new[] { "entity_type", "entity_id" });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_partition_date",
                schema: "monitoring",
                table: "audit_log",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_timestamp",
                schema: "monitoring",
                table: "audit_log",
                column: "timestamp");

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_user_id",
                schema: "monitoring",
                table: "audit_log",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_collection_attempts_partition_date",
                schema: "monitoring",
                table: "collection_attempts",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_collection_attempts_result",
                schema: "monitoring",
                table: "collection_attempts",
                column: "result");

            migrationBuilder.CreateIndex(
                name: "ix_collection_attempts_source_id",
                schema: "monitoring",
                table: "collection_attempts",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_collection_attempts_started_at",
                schema: "monitoring",
                table: "collection_attempts",
                column: "started_at");

            migrationBuilder.CreateIndex(
                name: "ix_collection_attempts_target_ip",
                schema: "monitoring",
                table: "collection_attempts",
                column: "target_ip");

            migrationBuilder.CreateIndex(
                name: "ix_collection_profiles_company_id",
                schema: "monitoring",
                table: "collection_profiles",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_collection_profiles_type",
                schema: "monitoring",
                table: "collection_profiles",
                column: "profile_type");

            migrationBuilder.CreateIndex(
                name: "ix_commands_company_id",
                schema: "monitoring",
                table: "commands",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_commands_expires_at",
                schema: "monitoring",
                table: "commands",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_commands_idempotency_key",
                schema: "monitoring",
                table: "commands",
                column: "idempotency_key");

            migrationBuilder.CreateIndex(
                name: "ix_commands_pick",
                schema: "monitoring",
                table: "commands",
                columns: new[] { "source_id", "status", "available_at", "priority" });

            migrationBuilder.CreateIndex(
                name: "ix_commands_source_id",
                schema: "monitoring",
                table: "commands",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_commands_status",
                schema: "monitoring",
                table: "commands",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_batch_id",
                schema: "monitoring",
                table: "ingest_batches",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_company_id",
                schema: "monitoring",
                table: "ingest_batches",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_received_at",
                schema: "monitoring",
                table: "ingest_batches",
                column: "received_at");

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_source_id",
                schema: "monitoring",
                table: "ingest_batches",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_source_sequence",
                schema: "monitoring",
                table: "ingest_batches",
                columns: new[] { "source_id", "sequence" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ingest_batches_status",
                schema: "monitoring",
                table: "ingest_batches",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_metric_definitions_metric_key",
                schema: "monitoring",
                table: "metric_definitions",
                column: "metric_key",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_metric_definitions_retention_class",
                schema: "monitoring",
                table: "metric_definitions",
                column: "retention_class");

            migrationBuilder.CreateIndex(
                name: "ix_metric_definitions_semantic_type",
                schema: "monitoring",
                table: "metric_definitions",
                column: "semantic_type");

            migrationBuilder.CreateIndex(
                name: "ix_metric_rollups_1h_asset_metric_time",
                schema: "monitoring",
                table: "metric_rollups_1h",
                columns: new[] { "asset_id", "metric_id", "window_start" });

            migrationBuilder.CreateIndex(
                name: "ix_metric_rollups_1h_partition_date",
                schema: "monitoring",
                table: "metric_rollups_1h",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_metric_rollups_5m_asset_metric_time",
                schema: "monitoring",
                table: "metric_rollups_5m",
                columns: new[] { "asset_id", "metric_id", "window_start" });

            migrationBuilder.CreateIndex(
                name: "ix_metric_rollups_5m_partition_date",
                schema: "monitoring",
                table: "metric_rollups_5m",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_metric_samples_asset_metric_time",
                schema: "monitoring",
                table: "metric_samples",
                columns: new[] { "asset_id", "metric_id", "collected_at" });

            migrationBuilder.CreateIndex(
                name: "ix_metric_samples_batch_id",
                schema: "monitoring",
                table: "metric_samples",
                column: "batch_id");

            migrationBuilder.CreateIndex(
                name: "ix_metric_samples_company_time",
                schema: "monitoring",
                table: "metric_samples",
                columns: new[] { "company_id", "collected_at" });

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_events_asset_id",
                schema: "monitoring",
                table: "monitoring_events",
                column: "asset_id");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_events_company_id",
                schema: "monitoring",
                table: "monitoring_events",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_events_event_key",
                schema: "monitoring",
                table: "monitoring_events",
                column: "event_key");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_events_occurred_at",
                schema: "monitoring",
                table: "monitoring_events",
                column: "occurred_at");

            migrationBuilder.CreateIndex(
                name: "ix_monitoring_events_state",
                schema: "monitoring",
                table: "monitoring_events",
                column: "state");

            migrationBuilder.CreateIndex(
                name: "ix_network_ranges_cidr",
                schema: "monitoring",
                table: "network_ranges",
                column: "cidr");

            migrationBuilder.CreateIndex(
                name: "ix_network_ranges_company_id",
                schema: "monitoring",
                table: "network_ranges",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_network_ranges_site_id",
                schema: "monitoring",
                table: "network_ranges",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_processing_jobs_available_at",
                schema: "monitoring",
                table: "processing_jobs",
                column: "available_at");

            migrationBuilder.CreateIndex(
                name: "ix_processing_jobs_company_id",
                schema: "monitoring",
                table: "processing_jobs",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_processing_jobs_lease_expires_at",
                schema: "monitoring",
                table: "processing_jobs",
                column: "lease_expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_processing_jobs_pick",
                schema: "monitoring",
                table: "processing_jobs",
                columns: new[] { "status", "available_at", "priority" });

            migrationBuilder.CreateIndex(
                name: "ix_processing_jobs_status",
                schema: "monitoring",
                table: "processing_jobs",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_sites_company_id",
                schema: "monitoring",
                table: "sites",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_sites_company_status",
                schema: "monitoring",
                table: "sites",
                columns: new[] { "company_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_sites_deleted_at",
                schema: "monitoring",
                table: "sites",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "ix_snmp_credentials_company_id",
                schema: "monitoring",
                table: "snmp_credentials",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_snmp_credentials_fingerprint",
                schema: "monitoring",
                table: "snmp_credentials",
                column: "fingerprint");

            migrationBuilder.CreateIndex(
                name: "ix_snmp_credentials_site_id",
                schema: "monitoring",
                table: "snmp_credentials",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_configurations_source_id",
                schema: "monitoring",
                table: "source_configurations",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_configurations_source_status",
                schema: "monitoring",
                table: "source_configurations",
                columns: new[] { "source_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_source_configurations_source_version",
                schema: "monitoring",
                table: "source_configurations",
                columns: new[] { "source_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_source_credentials_expires_at",
                schema: "monitoring",
                table: "source_credentials",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_source_credentials_family_id",
                schema: "monitoring",
                table: "source_credentials",
                column: "family_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_credentials_refresh_token_hash",
                schema: "monitoring",
                table: "source_credentials",
                column: "refresh_token_hash");

            migrationBuilder.CreateIndex(
                name: "ix_source_credentials_source_id",
                schema: "monitoring",
                table: "source_credentials",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_heartbeats_partition_date",
                schema: "monitoring",
                table: "source_heartbeats",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_source_heartbeats_received_at",
                schema: "monitoring",
                table: "source_heartbeats",
                column: "received_at");

            migrationBuilder.CreateIndex(
                name: "ix_source_heartbeats_source_id",
                schema: "monitoring",
                table: "source_heartbeats",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_sequence_gaps_source_id",
                schema: "monitoring",
                table: "source_sequence_gaps",
                column: "source_id");

            migrationBuilder.CreateIndex(
                name: "ix_source_sequence_gaps_status",
                schema: "monitoring",
                table: "source_sequence_gaps",
                column: "status");

            migrationBuilder.CreateIndex(
                name: "ix_sources_company_id",
                schema: "monitoring",
                table: "sources",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_sources_company_status",
                schema: "monitoring",
                table: "sources",
                columns: new[] { "company_id", "status" });

            migrationBuilder.CreateIndex(
                name: "ix_sources_deleted_at",
                schema: "monitoring",
                table: "sources",
                column: "deleted_at");

            migrationBuilder.CreateIndex(
                name: "ix_sources_installation_id",
                schema: "monitoring",
                table: "sources",
                column: "installation_id");

            migrationBuilder.CreateIndex(
                name: "ix_sources_last_heartbeat_at",
                schema: "monitoring",
                table: "sources",
                column: "last_heartbeat_at");

            migrationBuilder.CreateIndex(
                name: "ix_sources_site_id",
                schema: "monitoring",
                table: "sources",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "ix_stream_events_company_id",
                schema: "monitoring",
                table: "stream_events",
                column: "company_id");

            migrationBuilder.CreateIndex(
                name: "ix_stream_events_partition_date",
                schema: "monitoring",
                table: "stream_events",
                column: "partition_date");

            migrationBuilder.CreateIndex(
                name: "ix_stream_events_stream_type",
                schema: "monitoring",
                table: "stream_events",
                column: "stream_type");

            migrationBuilder.CreateIndex(
                name: "ix_stream_events_timestamp",
                schema: "monitoring",
                table: "stream_events",
                column: "timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "activation_tokens",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "agent_details",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "asset_current_state",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "asset_identifiers",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "asset_identity_conflicts",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "asset_metric_current",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "asset_source_bindings",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "assets",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "collection_attempts",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "collection_profiles",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "collector_details",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "commands",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "ingest_batches",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "metric_definitions",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "metric_rollups_1h",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "metric_rollups_5m",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "metric_samples",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "monitoring_events",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "network_ranges",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "processing_jobs",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "range_credential_bindings",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "snmp_credentials",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "source_configurations",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "source_credentials",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "source_heartbeats",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "source_sequence_cursors",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "source_sequence_gaps",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "sources",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "stream_events",
                schema: "monitoring");

            migrationBuilder.DropTable(
                name: "sites",
                schema: "monitoring");
        }
    }
}
