using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Postgres;

/// <summary>
///     DbContext principal do sistema de monitoramento.
/// </summary>
public class MonitoringDbContext : DbContext
{
    public MonitoringDbContext(DbContextOptions<MonitoringDbContext> options) : base(options)
    {
    }

    // ============================================
    // Sites
    // ============================================
    public DbSet<Site> Sites => Set<Site>();

    // ============================================
    // Sources & Auth
    // ============================================
    public DbSet<ActivationToken> ActivationTokens => Set<ActivationToken>();
    public DbSet<Source> Sources => Set<Source>();
    public DbSet<SourceCredential> SourceCredentials => Set<SourceCredential>();
    public DbSet<SourceConfiguration> SourceConfigurations => Set<SourceConfiguration>();
    public DbSet<SourceSequenceCursor> SourceSequenceCursors => Set<SourceSequenceCursor>();
    public DbSet<SourceHeartbeat> SourceHeartbeats => Set<SourceHeartbeat>();
    public DbSet<AgentDetails> AgentDetails => Set<AgentDetails>();
    public DbSet<CollectorDetails> CollectorDetails => Set<CollectorDetails>();

    // ============================================
    // SNMP & Network
    // ============================================
    public DbSet<SnmpCredential> SnmpCredentials => Set<SnmpCredential>();
    public DbSet<NetworkRange> NetworkRanges => Set<NetworkRange>();
    public DbSet<RangeCredentialBinding> RangeCredentialBindings => Set<RangeCredentialBinding>();

    // ============================================
    // Profiles & Metrics
    // ============================================
    public DbSet<CollectionProfile> CollectionProfiles => Set<CollectionProfile>();
    public DbSet<MetricDefinition> MetricDefinitions => Set<MetricDefinition>();

    // ============================================
    // Assets
    // ============================================
    public DbSet<Asset> Assets => Set<Asset>();
    public DbSet<AssetIdentifier> AssetIdentifiers => Set<AssetIdentifier>();
    public DbSet<AssetSourceBinding> AssetSourceBindings => Set<AssetSourceBinding>();
    public DbSet<AssetIdentityConflict> AssetIdentityConflicts => Set<AssetIdentityConflict>();
    public DbSet<AssetCurrentState> AssetCurrentStates => Set<AssetCurrentState>();
    public DbSet<AssetMetricCurrent> AssetMetricCurrents => Set<AssetMetricCurrent>();

    // ============================================
    // Ingest & Processing
    // ============================================
    public DbSet<IngestBatch> IngestBatches => Set<IngestBatch>();
    public DbSet<SourceSequenceGap> SourceSequenceGaps => Set<SourceSequenceGap>();
    public DbSet<ProcessingJob> ProcessingJobs => Set<ProcessingJob>();
    public DbSet<CollectionAttempt> CollectionAttempts => Set<CollectionAttempt>();

    // ============================================
    // Metrics (Partitioned)
    // ============================================
    public DbSet<MetricSample> MetricSamples => Set<MetricSample>();
    public DbSet<MetricRollup5m> MetricRollups5m => Set<MetricRollup5m>();
    public DbSet<MetricRollup1h> MetricRollups1h => Set<MetricRollup1h>();

    // ============================================
    // Events & Audit
    // ============================================
    public DbSet<MonitoringEvent> MonitoringEvents => Set<MonitoringEvent>();
    public DbSet<StreamEvent> StreamEvents => Set<StreamEvent>();
    public DbSet<Command> Commands => Set<Command>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Schema padrao
        modelBuilder.HasDefaultSchema("monitoring");

        ConfigureSites(modelBuilder);
        ConfigureSources(modelBuilder);
        ConfigureAssets(modelBuilder);
        ConfigureIngest(modelBuilder);
        ConfigureMetrics(modelBuilder);
        ConfigureEvents(modelBuilder);
        ConfigureSnmp(modelBuilder);
        ConfigureAudit(modelBuilder);
    }

    private static void ConfigureSites(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Site>(entity =>
        {
            entity.ToTable("sites", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Code).HasColumnName("code").HasMaxLength(50);
            entity.Property(e => e.Timezone).HasColumnName("timezone").HasMaxLength(100);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_sites_company_id");
            entity.HasIndex(e => new { e.CompanyId, e.Status }).HasDatabaseName("ix_sites_company_status");
            entity.HasIndex(e => e.DeletedAt).HasDatabaseName("ix_sites_deleted_at");
        });
    }

    private static void ConfigureSources(ModelBuilder modelBuilder)
    {
        // ActivationToken
        modelBuilder.Entity<ActivationToken>(entity =>
        {
            entity.ToTable("activation_tokens", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id");
            entity.Property(e => e.SourceType).HasColumnName("source_type").HasConversion<string>();
            entity.Property(e => e.TokenHash).HasColumnName("token_hash").IsRequired();
            entity.Property(e => e.DisplayHint).HasColumnName("display_hint").HasMaxLength(20);
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.UsedAt).HasColumnName("used_at");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_activation_tokens_company_id");
            entity.HasIndex(e => e.TokenHash).HasDatabaseName("ix_activation_tokens_token_hash");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_activation_tokens_expires_at");
        });

        // Source
        modelBuilder.Entity<Source>(entity =>
        {
            entity.ToTable("sources", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id").IsRequired();
            entity.Property(e => e.SourceType).HasColumnName("source_type").HasConversion<string>();
            entity.Property(e => e.InstallationId).HasColumnName("installation_id").IsRequired();
            entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(255).IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.Platform).HasColumnName("platform").HasMaxLength(100);
            entity.Property(e => e.Architecture).HasColumnName("architecture").HasMaxLength(50);
            entity.Property(e => e.CurrentVersion).HasColumnName("current_version").HasMaxLength(50);
            entity.Property(e => e.DesiredVersion).HasColumnName("desired_version").HasMaxLength(50);
            entity.Property(e => e.MinimumVersion).HasColumnName("minimum_version").HasMaxLength(50);
            entity.Property(e => e.ConfigVersion).HasColumnName("config_version");
            entity.Property(e => e.HeartbeatIntervalSeconds).HasColumnName("heartbeat_interval_seconds");
            entity.Property(e => e.LastHeartbeatAt).HasColumnName("last_heartbeat_at");
            entity.Property(e => e.LastIngestAt).HasColumnName("last_ingest_at");
            entity.Property(e => e.LastIp).HasColumnName("last_ip").HasMaxLength(45);
            entity.Property(e => e.ClockSkewSeconds).HasColumnName("clock_skew_seconds");
            entity.Property(e => e.CapabilitiesJson).HasColumnName("capabilities_json").HasColumnType("jsonb");
            entity.Property(e => e.HealthSummaryJson).HasColumnName("health_summary_json").HasColumnType("jsonb");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_sources_company_id");
            entity.HasIndex(e => e.SiteId).HasDatabaseName("ix_sources_site_id");
            entity.HasIndex(e => e.InstallationId).HasDatabaseName("ix_sources_installation_id");
            entity.HasIndex(e => new { e.CompanyId, e.Status }).HasDatabaseName("ix_sources_company_status");
            entity.HasIndex(e => e.LastHeartbeatAt).HasDatabaseName("ix_sources_last_heartbeat_at");
            entity.HasIndex(e => e.DeletedAt).HasDatabaseName("ix_sources_deleted_at");
        });

        // SourceCredential
        modelBuilder.Entity<SourceCredential>(entity =>
        {
            entity.ToTable("source_credentials", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.FamilyId).HasColumnName("family_id").IsRequired();
            entity.Property(e => e.CredentialVersion).HasColumnName("credential_version");
            entity.Property(e => e.RefreshTokenHash).HasColumnName("refresh_token_hash").IsRequired();
            entity.Property(e => e.IssuedAt).HasColumnName("issued_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.LastUsedAt).HasColumnName("last_used_at");
            entity.Property(e => e.ReplacedById).HasColumnName("replaced_by_id");
            entity.Property(e => e.RevokedAt).HasColumnName("revoked_at");
            entity.Property(e => e.ReuseDetectedAt).HasColumnName("reuse_detected_at");

            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_source_credentials_source_id");
            entity.HasIndex(e => e.FamilyId).HasDatabaseName("ix_source_credentials_family_id");
            entity.HasIndex(e => e.RefreshTokenHash).HasDatabaseName("ix_source_credentials_refresh_token_hash");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_source_credentials_expires_at");
        });

        // SourceConfiguration
        modelBuilder.Entity<SourceConfiguration>(entity =>
        {
            entity.ToTable("source_configurations", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.Version).HasColumnName("version");
            entity.Property(e => e.Config).HasColumnName("config").HasColumnType("jsonb").IsRequired();
            entity.Property(e => e.ConfigHash).HasColumnName("config_hash").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.ActivatedAt).HasColumnName("activated_at");

            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_source_configurations_source_id");
            entity.HasIndex(e => new { e.SourceId, e.Version }).IsUnique().HasDatabaseName("ix_source_configurations_source_version");
            entity.HasIndex(e => new { e.SourceId, e.Status }).HasDatabaseName("ix_source_configurations_source_status");
        });

        // SourceSequenceCursor
        modelBuilder.Entity<SourceSequenceCursor>(entity =>
        {
            entity.ToTable("source_sequence_cursors", "monitoring");

            entity.HasKey(e => e.SourceId);

            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.HighestReceivedSequence).HasColumnName("highest_received_sequence");
            entity.Property(e => e.HighestContiguousSequence).HasColumnName("highest_contiguous_sequence");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // SourceHeartbeat (partitioned by month)
        modelBuilder.Entity<SourceHeartbeat>(entity =>
        {
            entity.ToTable("source_heartbeats", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceTime).HasColumnName("source_time");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.LastIp).HasColumnName("last_ip").HasMaxLength(45);
            entity.Property(e => e.ClockSkewSeconds).HasColumnName("clock_skew_seconds");
            entity.Property(e => e.CapabilitiesJson).HasColumnName("capabilities_json").HasColumnType("jsonb");
            entity.Property(e => e.HealthSummaryJson).HasColumnName("health_summary_json").HasColumnType("jsonb");
            entity.Property(e => e.PendingCommands).HasColumnName("pending_commands");
            entity.Property(e => e.DesiredConfigVersion).HasColumnName("desired_config_version");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_source_heartbeats_source_id");
            entity.HasIndex(e => e.ReceivedAt).HasDatabaseName("ix_source_heartbeats_received_at");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_source_heartbeats_partition_date");
        });

        // AgentDetails
        modelBuilder.Entity<AgentDetails>(entity =>
        {
            entity.ToTable("agent_details", "monitoring");

            entity.HasKey(e => e.SourceId);

            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.OsName).HasColumnName("os_name").HasMaxLength(100);
            entity.Property(e => e.OsVersion).HasColumnName("os_version").HasMaxLength(100);
            entity.Property(e => e.OsArchitecture).HasColumnName("os_architecture").HasMaxLength(50);
            entity.Property(e => e.Hostname).HasColumnName("hostname").HasMaxLength(255);
            entity.Property(e => e.Domain).HasColumnName("domain").HasMaxLength(255);
            entity.Property(e => e.BootId).HasColumnName("boot_id").HasMaxLength(100);
            entity.Property(e => e.BootTime).HasColumnName("boot_time");
            entity.Property(e => e.CpuCount).HasColumnName("cpu_count");
            entity.Property(e => e.TotalMemoryBytes).HasColumnName("total_memory_bytes");
            entity.Property(e => e.MachineId).HasColumnName("machine_id").HasMaxLength(255);
            entity.Property(e => e.VirtualizationRole).HasColumnName("virtualization_role").HasMaxLength(50);
            entity.Property(e => e.VirtualizationSystem).HasColumnName("virtualization_system").HasMaxLength(100);
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // CollectorDetails
        modelBuilder.Entity<CollectorDetails>(entity =>
        {
            entity.ToTable("collector_details", "monitoring");

            entity.HasKey(e => e.SourceId);

            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.CollectorType).HasColumnName("collector_type").HasMaxLength(50);
            entity.Property(e => e.OsName).HasColumnName("os_name").HasMaxLength(100);
            entity.Property(e => e.OsVersion).HasColumnName("os_version").HasMaxLength(100);
            entity.Property(e => e.Hostname).HasColumnName("hostname").HasMaxLength(255);
            entity.Property(e => e.NetworkInterface).HasColumnName("network_interface").HasMaxLength(100);
            entity.Property(e => e.PrimaryIp).HasColumnName("primary_ip").HasMaxLength(45);
            entity.Property(e => e.SnmpTimeoutMs).HasColumnName("snmp_timeout_ms");
            entity.Property(e => e.SnmpRetries).HasColumnName("snmp_retries");
            entity.Property(e => e.MaxConcurrentCollections).HasColumnName("max_concurrent_collections");
            entity.Property(e => e.CapabilitiesJson).HasColumnName("capabilities_json").HasColumnType("jsonb");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });
    }

    private static void ConfigureSnmp(ModelBuilder modelBuilder)
    {
        // SnmpCredential
        modelBuilder.Entity<SnmpCredential>(entity =>
        {
            entity.ToTable("snmp_credentials", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(e => e.Version).HasColumnName("version").HasMaxLength(10);
            entity.Property(e => e.SecurityLevel).HasColumnName("security_level").HasMaxLength(50);
            entity.Property(e => e.Username).HasColumnName("username").HasMaxLength(100);
            entity.Property(e => e.AuthProtocol).HasColumnName("auth_protocol").HasMaxLength(50);
            entity.Property(e => e.PrivacyProtocol).HasColumnName("privacy_protocol").HasMaxLength(50);
            entity.Property(e => e.EncryptedSecret).HasColumnName("encrypted_secret").IsRequired();
            entity.Property(e => e.Nonce).HasColumnName("nonce").IsRequired();
            entity.Property(e => e.Tag).HasColumnName("tag").IsRequired();
            entity.Property(e => e.KeyVersion).HasColumnName("key_version");
            entity.Property(e => e.Fingerprint).HasColumnName("fingerprint").HasMaxLength(64);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.RotatedAt).HasColumnName("rotated_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_snmp_credentials_company_id");
            entity.HasIndex(e => e.SiteId).HasDatabaseName("ix_snmp_credentials_site_id");
            entity.HasIndex(e => e.Fingerprint).HasDatabaseName("ix_snmp_credentials_fingerprint");
        });

        // NetworkRange
        modelBuilder.Entity<NetworkRange>(entity =>
        {
            entity.ToTable("network_ranges", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(e => e.Cidr).HasColumnName("cidr").HasMaxLength(50);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.DiscoveryIntervalMinutes).HasColumnName("discovery_interval_minutes");
            entity.Property(e => e.LastDiscoveryAt).HasColumnName("last_discovery_at");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasOne(e => e.Site)
                .WithMany()
                .HasForeignKey(e => e.SiteId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_network_ranges_company_id");
            entity.HasIndex(e => e.SiteId).HasDatabaseName("ix_network_ranges_site_id");
            entity.HasIndex(e => e.Cidr).HasDatabaseName("ix_network_ranges_cidr");
        });

        // RangeCredentialBinding
        modelBuilder.Entity<RangeCredentialBinding>(entity =>
        {
            entity.ToTable("range_credential_bindings", "monitoring");

            entity.HasKey(e => new { e.RangeId, e.CredentialId });

            entity.Property(e => e.RangeId).HasColumnName("range_id");
            entity.Property(e => e.CredentialId).HasColumnName("credential_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.Priority).HasColumnName("priority");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // CollectionProfile
        modelBuilder.Entity<CollectionProfile>(entity =>
        {
            entity.ToTable("collection_profiles", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.Name).HasColumnName("name").HasMaxLength(255);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.ProfileType).HasColumnName("profile_type").HasMaxLength(50);
            entity.Property(e => e.Metrics).HasColumnName("metrics").HasColumnType("jsonb");
            entity.Property(e => e.IntervalSeconds).HasColumnName("interval_seconds");
            entity.Property(e => e.Active).HasColumnName("active");
            entity.Property(e => e.Priority).HasColumnName("priority");
            entity.Property(e => e.CreatedBy).HasColumnName("created_by");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_collection_profiles_company_id");
            entity.HasIndex(e => e.ProfileType).HasDatabaseName("ix_collection_profiles_type");
        });
    }

    private static void ConfigureAssets(ModelBuilder modelBuilder)
    {
        // Asset
        modelBuilder.Entity<Asset>(entity =>
        {
            entity.ToTable("assets", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id").IsRequired();
            entity.Property(e => e.AssetType).HasColumnName("asset_type").HasMaxLength(50);
            entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(255);
            entity.Property(e => e.LifecycleStatus).HasColumnName("lifecycle_status").HasMaxLength(50);
            entity.Property(e => e.Manufacturer).HasColumnName("manufacturer").HasMaxLength(100);
            entity.Property(e => e.Model).HasColumnName("model").HasMaxLength(100);
            entity.Property(e => e.SerialNumber).HasColumnName("serial_number").HasMaxLength(100);
            entity.Property(e => e.PrimaryIp).HasColumnName("primary_ip").HasMaxLength(45);
            entity.Property(e => e.PrimaryMac).HasColumnName("primary_mac").HasMaxLength(17);
            entity.Property(e => e.Hostname).HasColumnName("hostname").HasMaxLength(255);
            entity.Property(e => e.Properties).HasColumnName("properties").HasColumnType("jsonb");
            entity.Property(e => e.Tags).HasColumnName("tags").HasColumnType("text[]");
            entity.Property(e => e.FirstSeenAt).HasColumnName("first_seen_at");
            entity.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
            entity.Property(e => e.DeletedAt).HasColumnName("deleted_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_assets_company_id");
            entity.HasIndex(e => e.SiteId).HasDatabaseName("ix_assets_site_id");
            entity.HasIndex(e => e.AssetType).HasDatabaseName("ix_assets_asset_type");
            entity.HasIndex(e => e.PrimaryIp).HasDatabaseName("ix_assets_primary_ip");
            entity.HasIndex(e => e.Hostname).HasDatabaseName("ix_assets_hostname");
            entity.HasIndex(e => e.LifecycleStatus).HasDatabaseName("ix_assets_lifecycle_status");
            entity.HasIndex(e => e.LastSeenAt).HasDatabaseName("ix_assets_last_seen_at");
            entity.HasIndex(e => e.DeletedAt).HasDatabaseName("ix_assets_deleted_at");
        });

        // AssetIdentifier
        modelBuilder.Entity<AssetIdentifier>(entity =>
        {
            entity.ToTable("asset_identifiers", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.AssetId).HasColumnName("asset_id").IsRequired();
            entity.Property(e => e.IdentifierType).HasColumnName("identifier_type").HasMaxLength(50);
            entity.Property(e => e.NormalizedValue).HasColumnName("normalized_value").HasMaxLength(255);
            entity.Property(e => e.ValueHash).HasColumnName("value_hash").IsRequired();
            entity.Property(e => e.Confidence).HasColumnName("confidence").HasConversion<string>();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.FirstSeenAt).HasColumnName("first_seen_at");
            entity.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_asset_identifiers_company_id");
            entity.HasIndex(e => e.AssetId).HasDatabaseName("ix_asset_identifiers_asset_id");
            entity.HasIndex(e => e.ValueHash).HasDatabaseName("ix_asset_identifiers_value_hash");
            entity.HasIndex(e => new { e.IdentifierType, e.NormalizedValue }).HasDatabaseName("ix_asset_identifiers_type_value");
        });

        // AssetSourceBinding
        modelBuilder.Entity<AssetSourceBinding>(entity =>
        {
            entity.ToTable("asset_source_bindings", "monitoring");

            entity.HasKey(e => new { e.AssetId, e.SourceId, e.LocalAssetId });

            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.LocalAssetId).HasColumnName("local_asset_id").HasMaxLength(255);
            entity.Property(e => e.Role).HasColumnName("role").HasMaxLength(50);
            entity.Property(e => e.FirstSeenAt).HasColumnName("first_seen_at");
            entity.Property(e => e.LastSeenAt).HasColumnName("last_seen_at");
            entity.Property(e => e.Active).HasColumnName("active");
        });

        // AssetIdentityConflict
        modelBuilder.Entity<AssetIdentityConflict>(entity =>
        {
            entity.ToTable("asset_identity_conflicts", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.IdentifierType).HasColumnName("identifier_type").HasMaxLength(50);
            entity.Property(e => e.NormalizedValue).HasColumnName("normalized_value").HasMaxLength(255);
            entity.Property(e => e.AssetId1).HasColumnName("asset_id_1");
            entity.Property(e => e.AssetId2).HasColumnName("asset_id_2");
            entity.Property(e => e.ConflictType).HasColumnName("conflict_type").HasMaxLength(50);
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.Resolution).HasColumnName("resolution").HasMaxLength(500);
            entity.Property(e => e.ResolvedBy).HasColumnName("resolved_by");
            entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(e => e.DetectedAt).HasColumnName("detected_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_asset_identity_conflicts_company_id");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_asset_identity_conflicts_status");
        });

        // AssetCurrentState
        modelBuilder.Entity<AssetCurrentState>(entity =>
        {
            entity.ToTable("asset_current_state", "monitoring");

            entity.HasKey(e => e.AssetId);

            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.Health).HasColumnName("health").HasConversion<string>();
            entity.Property(e => e.LastAttemptAt).HasColumnName("last_attempt_at");
            entity.Property(e => e.LastSuccessAt).HasColumnName("last_success_at");
            entity.Property(e => e.FreshnessSeconds).HasColumnName("freshness_seconds");
            entity.Property(e => e.ExpectedIntervalSeconds).HasColumnName("expected_interval_seconds");
            entity.Property(e => e.ConsecutiveFailures).HasColumnName("consecutive_failures");
            entity.Property(e => e.LastFailureResult).HasColumnName("last_failure_result").HasMaxLength(500);
            entity.Property(e => e.LastFailureCode).HasColumnName("last_failure_code").HasMaxLength(50);
            entity.Property(e => e.Summary).HasColumnName("summary").HasColumnType("jsonb");
            entity.Property(e => e.ComputedAt).HasColumnName("computed_at");
            entity.Property(e => e.Version).HasColumnName("version");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_asset_current_state_company_id");
            entity.HasIndex(e => e.Health).HasDatabaseName("ix_asset_current_state_health");
            entity.HasIndex(e => e.LastSuccessAt).HasDatabaseName("ix_asset_current_state_last_success_at");
        });

        // AssetMetricCurrent
        modelBuilder.Entity<AssetMetricCurrent>(entity =>
        {
            entity.ToTable("asset_metric_current", "monitoring");

            entity.HasKey(e => new { e.AssetId, e.MetricId, e.DimensionHash });

            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.MetricId).HasColumnName("metric_id");
            entity.Property(e => e.DimensionHash).HasColumnName("dimension_hash");
            entity.Property(e => e.Dimensions).HasColumnName("dimensions").HasColumnType("jsonb");
            entity.Property(e => e.CollectedAt).HasColumnName("collected_at");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.ValueDouble).HasColumnName("value_double");
            entity.Property(e => e.ValueLong).HasColumnName("value_long");
            entity.Property(e => e.ValueBoolean).HasColumnName("value_boolean");
            entity.Property(e => e.ValueString).HasColumnName("value_string");
            entity.Property(e => e.Quality).HasColumnName("quality").HasMaxLength(50);
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.BatchId).HasColumnName("batch_id");

            entity.HasIndex(e => new { e.AssetId, e.MetricId }).HasDatabaseName("ix_asset_metric_current_asset_metric");
        });
    }

    private static void ConfigureIngest(ModelBuilder modelBuilder)
    {
        // IngestBatch
        modelBuilder.Entity<IngestBatch>(entity =>
        {
            entity.ToTable("ingest_batches", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.BatchId).HasColumnName("batch_id").IsRequired();
            entity.Property(e => e.Sequence).HasColumnName("sequence");
            entity.Property(e => e.SchemaVersion).HasColumnName("schema_version");
            entity.Property(e => e.SourceVersion).HasColumnName("source_version").HasMaxLength(50);
            entity.Property(e => e.ContentSha256).HasColumnName("content_sha256");
            entity.Property(e => e.RecordCount).HasColumnName("record_count");
            entity.Property(e => e.CompressedBytes).HasColumnName("compressed_bytes");
            entity.Property(e => e.UncompressedBytes).HasColumnName("uncompressed_bytes");
            entity.Property(e => e.CollectedFrom).HasColumnName("collected_from");
            entity.Property(e => e.CollectedTo).HasColumnName("collected_to");
            entity.Property(e => e.SentAt).HasColumnName("sent_at");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.Payload).HasColumnName("payload").HasColumnType("jsonb");
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.ProcessingAttempts).HasColumnName("processing_attempts");
            entity.Property(e => e.ProcessedAt).HasColumnName("processed_at");
            entity.Property(e => e.LastErrorCode).HasColumnName("last_error_code").HasMaxLength(50);
            entity.Property(e => e.LastErrorDetail).HasColumnName("last_error_detail");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_ingest_batches_company_id");
            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_ingest_batches_source_id");
            entity.HasIndex(e => new { e.SourceId, e.Sequence }).IsUnique().HasDatabaseName("ix_ingest_batches_source_sequence");
            entity.HasIndex(e => e.BatchId).HasDatabaseName("ix_ingest_batches_batch_id");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_ingest_batches_status");
            entity.HasIndex(e => e.ReceivedAt).HasDatabaseName("ix_ingest_batches_received_at");
        });

        // SourceSequenceGap
        modelBuilder.Entity<SourceSequenceGap>(entity =>
        {
            entity.ToTable("source_sequence_gaps", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.GapStartSequence).HasColumnName("gap_start_sequence");
            entity.Property(e => e.GapEndSequence).HasColumnName("gap_end_sequence");
            entity.Property(e => e.MissingCount).HasColumnName("missing_count");
            entity.Property(e => e.Status).HasColumnName("status").HasMaxLength(50);
            entity.Property(e => e.FilledAt).HasColumnName("filled_at");
            entity.Property(e => e.DetectedAt).HasColumnName("detected_at");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_source_sequence_gaps_source_id");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_source_sequence_gaps_status");
        });

        // ProcessingJob
        modelBuilder.Entity<ProcessingJob>(entity =>
        {
            entity.ToTable("processing_jobs", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.BatchRowId).HasColumnName("batch_row_id").IsRequired();
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.Priority).HasColumnName("priority");
            entity.Property(e => e.AvailableAt).HasColumnName("available_at");
            entity.Property(e => e.LeasedBy).HasColumnName("leased_by").HasMaxLength(100);
            entity.Property(e => e.LeaseExpiresAt).HasColumnName("lease_expires_at");
            entity.Property(e => e.Attempts).HasColumnName("attempts");
            entity.Property(e => e.MaxAttempts).HasColumnName("max_attempts");
            entity.Property(e => e.LastErrorCode).HasColumnName("last_error_code").HasMaxLength(50);
            entity.Property(e => e.LastErrorDetail).HasColumnName("last_error_detail");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.CompletedAt).HasColumnName("completed_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_processing_jobs_company_id");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_processing_jobs_status");
            entity.HasIndex(e => e.AvailableAt).HasDatabaseName("ix_processing_jobs_available_at");
            entity.HasIndex(e => e.LeaseExpiresAt).HasDatabaseName("ix_processing_jobs_lease_expires_at");
            entity.HasIndex(e => new { e.Status, e.AvailableAt, e.Priority }).HasDatabaseName("ix_processing_jobs_pick");
        });

        // CollectionAttempt (partitioned)
        modelBuilder.Entity<CollectionAttempt>(entity =>
        {
            entity.ToTable("collection_attempts", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.TargetAssetId).HasColumnName("target_asset_id");
            entity.Property(e => e.TargetIp).HasColumnName("target_ip").HasMaxLength(45);
            entity.Property(e => e.LocalAssetId).HasColumnName("local_asset_id").HasMaxLength(255);
            entity.Property(e => e.CredentialId).HasColumnName("credential_id").IsRequired();
            entity.Property(e => e.CollectionType).HasColumnName("collection_type").HasMaxLength(50);
            entity.Property(e => e.Oid).HasColumnName("oid").HasMaxLength(500);
            entity.Property(e => e.StartedAt).HasColumnName("started_at");
            entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
            entity.Property(e => e.DurationMs).HasColumnName("duration_ms");
            entity.Property(e => e.Result).HasColumnName("result").HasMaxLength(50);
            entity.Property(e => e.ErrorCode).HasColumnName("error_code").HasMaxLength(50);
            entity.Property(e => e.ErrorDetail).HasColumnName("error_detail");
            entity.Property(e => e.RecordsCollected).HasColumnName("records_collected");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_collection_attempts_source_id");
            entity.HasIndex(e => e.TargetIp).HasDatabaseName("ix_collection_attempts_target_ip");
            entity.HasIndex(e => e.Result).HasDatabaseName("ix_collection_attempts_result");
            entity.HasIndex(e => e.StartedAt).HasDatabaseName("ix_collection_attempts_started_at");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_collection_attempts_partition_date");
        });
    }

    private static void ConfigureMetrics(ModelBuilder modelBuilder)
    {
        // MetricDefinition
        modelBuilder.Entity<MetricDefinition>(entity =>
        {
            entity.ToTable("metric_definitions", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id").UseIdentityByDefaultColumn();
            entity.Property(e => e.MetricKey).HasColumnName("metric_key").HasMaxLength(100).IsRequired();
            entity.Property(e => e.DisplayName).HasColumnName("display_name").HasMaxLength(255);
            entity.Property(e => e.Description).HasColumnName("description").HasMaxLength(500);
            entity.Property(e => e.ValueType).HasColumnName("value_type").HasMaxLength(50);
            entity.Property(e => e.Unit).HasColumnName("unit").HasMaxLength(50);
            entity.Property(e => e.SemanticType).HasColumnName("semantic_type").HasMaxLength(50);
            entity.Property(e => e.Aggregation).HasColumnName("aggregation").HasMaxLength(50);
            entity.Property(e => e.RetentionClass).HasColumnName("retention_class").HasMaxLength(50);
            entity.Property(e => e.MaxDimensionSets).HasColumnName("max_dimension_sets");
            entity.Property(e => e.IntroducedSchemaVersion).HasColumnName("introduced_schema_version");
            entity.Property(e => e.Active).HasColumnName("active");
            entity.Property(e => e.Metadata).HasColumnName("metadata").HasColumnType("jsonb");

            entity.HasIndex(e => e.MetricKey).IsUnique().HasDatabaseName("ix_metric_definitions_metric_key");
            entity.HasIndex(e => e.SemanticType).HasDatabaseName("ix_metric_definitions_semantic_type");
            entity.HasIndex(e => e.RetentionClass).HasDatabaseName("ix_metric_definitions_retention_class");
        });

        // MetricSample (partitioned)
        modelBuilder.Entity<MetricSample>(entity =>
        {
            entity.ToTable("metric_samples", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CollectedAt).HasColumnName("collected_at");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id").IsRequired();
            entity.Property(e => e.AssetId).HasColumnName("asset_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.MetricId).HasColumnName("metric_id").IsRequired();
            entity.Property(e => e.DimensionHash).HasColumnName("dimension_hash");
            entity.Property(e => e.Dimensions).HasColumnName("dimensions").HasColumnType("jsonb");
            entity.Property(e => e.ValueDouble).HasColumnName("value_double");
            entity.Property(e => e.ValueLong).HasColumnName("value_long");
            entity.Property(e => e.ValueBoolean).HasColumnName("value_boolean");
            entity.Property(e => e.ValueString).HasColumnName("value_string");
            entity.Property(e => e.Quality).HasColumnName("quality").HasMaxLength(50);
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.BatchId).HasColumnName("batch_id");
            entity.Property(e => e.RecordId).HasColumnName("record_id");

            // Composite primary key for partitioning support
            entity.HasKey(e => new { e.Id, e.CollectedAt });

            entity.HasIndex(e => new { e.AssetId, e.MetricId, e.CollectedAt }).HasDatabaseName("ix_metric_samples_asset_metric_time");
            entity.HasIndex(e => new { e.CompanyId, e.CollectedAt }).HasDatabaseName("ix_metric_samples_company_time");
            entity.HasIndex(e => e.BatchId).HasDatabaseName("ix_metric_samples_batch_id");
        });

        // MetricRollup5m (partitioned)
        modelBuilder.Entity<MetricRollup5m>(entity =>
        {
            entity.ToTable("metric_rollups_5m", "monitoring");

            entity.HasKey(e => new { e.MetricId, e.AssetId, e.DimensionHash, e.WindowStart });

            entity.Property(e => e.MetricId).HasColumnName("metric_id");
            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.DimensionHash).HasColumnName("dimension_hash");
            entity.Property(e => e.Dimensions).HasColumnName("dimensions").HasColumnType("jsonb");
            entity.Property(e => e.WindowStart).HasColumnName("window_start");
            entity.Property(e => e.WindowEnd).HasColumnName("window_end");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.Min).HasColumnName("min");
            entity.Property(e => e.Max).HasColumnName("max");
            entity.Property(e => e.Avg).HasColumnName("avg");
            entity.Property(e => e.Sum).HasColumnName("sum");
            entity.Property(e => e.Count).HasColumnName("count");
            entity.Property(e => e.Last).HasColumnName("last");
            entity.Property(e => e.Rate).HasColumnName("rate");
            entity.Property(e => e.TextValue).HasColumnName("text_value");
            entity.Property(e => e.Quality).HasColumnName("quality").HasMaxLength(50);
            entity.Property(e => e.SampleCount).HasColumnName("sample_count");
            entity.Property(e => e.ComputedAt).HasColumnName("computed_at");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => new { e.AssetId, e.MetricId, e.WindowStart }).HasDatabaseName("ix_metric_rollups_5m_asset_metric_time");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_metric_rollups_5m_partition_date");
        });

        // MetricRollup1h (partitioned)
        modelBuilder.Entity<MetricRollup1h>(entity =>
        {
            entity.ToTable("metric_rollups_1h", "monitoring");

            entity.HasKey(e => new { e.MetricId, e.AssetId, e.DimensionHash, e.WindowStart });

            entity.Property(e => e.MetricId).HasColumnName("metric_id");
            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.DimensionHash).HasColumnName("dimension_hash");
            entity.Property(e => e.Dimensions).HasColumnName("dimensions").HasColumnType("jsonb");
            entity.Property(e => e.WindowStart).HasColumnName("window_start");
            entity.Property(e => e.WindowEnd).HasColumnName("window_end");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.Min).HasColumnName("min");
            entity.Property(e => e.Max).HasColumnName("max");
            entity.Property(e => e.Avg).HasColumnName("avg");
            entity.Property(e => e.Sum).HasColumnName("sum");
            entity.Property(e => e.Count).HasColumnName("count");
            entity.Property(e => e.Last).HasColumnName("last");
            entity.Property(e => e.Rate).HasColumnName("rate");
            entity.Property(e => e.TextValue).HasColumnName("text_value");
            entity.Property(e => e.Quality).HasColumnName("quality").HasMaxLength(50);
            entity.Property(e => e.SampleCount).HasColumnName("sample_count");
            entity.Property(e => e.ComputedAt).HasColumnName("computed_at");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => new { e.AssetId, e.MetricId, e.WindowStart }).HasDatabaseName("ix_metric_rollups_1h_asset_metric_time");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_metric_rollups_1h_partition_date");
        });
    }

    private static void ConfigureEvents(ModelBuilder modelBuilder)
    {
        // MonitoringEvent
        modelBuilder.Entity<MonitoringEvent>(entity =>
        {
            entity.ToTable("monitoring_events", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id");
            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(100);
            entity.Property(e => e.Severity).HasColumnName("severity").HasConversion<string>();
            entity.Property(e => e.Title).HasColumnName("title").HasMaxLength(255);
            entity.Property(e => e.Message).HasColumnName("message").HasMaxLength(1000);
            entity.Property(e => e.EventKey).HasColumnName("event_key").HasMaxLength(255);
            entity.Property(e => e.State).HasColumnName("state").HasConversion<string>();
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
            entity.Property(e => e.ResolvedAt).HasColumnName("resolved_at");
            entity.Property(e => e.Payload).HasColumnName("payload").HasColumnType("jsonb");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_monitoring_events_company_id");
            entity.HasIndex(e => e.EventKey).HasDatabaseName("ix_monitoring_events_event_key");
            entity.HasIndex(e => e.State).HasDatabaseName("ix_monitoring_events_state");
            entity.HasIndex(e => e.OccurredAt).HasDatabaseName("ix_monitoring_events_occurred_at");
            entity.HasIndex(e => e.AssetId).HasDatabaseName("ix_monitoring_events_asset_id");
        });

        // StreamEvent (partitioned)
        modelBuilder.Entity<StreamEvent>(entity =>
        {
            entity.ToTable("stream_events", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SiteId).HasColumnName("site_id");
            entity.Property(e => e.AssetId).HasColumnName("asset_id");
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.StreamType).HasColumnName("stream_type").HasMaxLength(50);
            entity.Property(e => e.EventKind).HasColumnName("event_kind").HasMaxLength(50);
            entity.Property(e => e.Timestamp).HasColumnName("timestamp");
            entity.Property(e => e.Payload).HasColumnName("payload").HasColumnType("jsonb");
            entity.Property(e => e.ReceivedAt).HasColumnName("received_at");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_stream_events_company_id");
            entity.HasIndex(e => e.StreamType).HasDatabaseName("ix_stream_events_stream_type");
            entity.HasIndex(e => e.Timestamp).HasDatabaseName("ix_stream_events_timestamp");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_stream_events_partition_date");
        });

        // Command
        modelBuilder.Entity<Command>(entity =>
        {
            entity.ToTable("commands", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.SourceId).HasColumnName("source_id").IsRequired();
            entity.Property(e => e.CommandType).HasColumnName("command_type").HasMaxLength(100);
            entity.Property(e => e.Parameters).HasColumnName("parameters").HasColumnType("jsonb");
            entity.Property(e => e.IdempotencyKey).HasColumnName("idempotency_key").HasMaxLength(100);
            entity.Property(e => e.Status).HasColumnName("status").HasConversion<string>();
            entity.Property(e => e.Priority).HasColumnName("priority");
            entity.Property(e => e.AvailableAt).HasColumnName("available_at");
            entity.Property(e => e.ExpiresAt).HasColumnName("expires_at");
            entity.Property(e => e.LeasedAt).HasColumnName("leased_at");
            entity.Property(e => e.LeaseExpiresAt).HasColumnName("lease_expires_at");
            entity.Property(e => e.LeaseTokenHash).HasColumnName("lease_token_hash");
            entity.Property(e => e.Attempts).HasColumnName("attempts");
            entity.Property(e => e.MaxAttempts).HasColumnName("max_attempts");
            entity.Property(e => e.RequestedBy).HasColumnName("requested_by");
            entity.Property(e => e.RequestedAt).HasColumnName("requested_at");
            entity.Property(e => e.StartedAt).HasColumnName("started_at");
            entity.Property(e => e.CompletedAt).HasColumnName("completed_at");
            entity.Property(e => e.Result).HasColumnName("result");
            entity.Property(e => e.ErrorCode).HasColumnName("error_code").HasMaxLength(50);

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_commands_company_id");
            entity.HasIndex(e => e.SourceId).HasDatabaseName("ix_commands_source_id");
            entity.HasIndex(e => e.IdempotencyKey).HasDatabaseName("ix_commands_idempotency_key");
            entity.HasIndex(e => e.Status).HasDatabaseName("ix_commands_status");
            entity.HasIndex(e => e.ExpiresAt).HasDatabaseName("ix_commands_expires_at");
            entity.HasIndex(e => new { e.SourceId, e.Status, e.AvailableAt, e.Priority }).HasDatabaseName("ix_commands_pick");
        });
    }

    private static void ConfigureAudit(ModelBuilder modelBuilder)
    {
        // AuditLog (partitioned)
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.ToTable("audit_log", "monitoring");

            entity.HasKey(e => e.Id);

            entity.Property(e => e.Id).HasColumnName("id");
            entity.Property(e => e.CompanyId).HasColumnName("company_id").IsRequired();
            entity.Property(e => e.UserId).HasColumnName("user_id");
            entity.Property(e => e.SourceId).HasColumnName("source_id");
            entity.Property(e => e.Action).HasColumnName("action").HasMaxLength(100);
            entity.Property(e => e.EntityType).HasColumnName("entity_type").HasMaxLength(100);
            entity.Property(e => e.EntityId).HasColumnName("entity_id");
            entity.Property(e => e.OldValues).HasColumnName("old_values").HasColumnType("jsonb");
            entity.Property(e => e.NewValues).HasColumnName("new_values").HasColumnType("jsonb");
            entity.Property(e => e.IpAddress).HasColumnName("ip_address").HasMaxLength(45);
            entity.Property(e => e.UserAgent).HasColumnName("user_agent").HasMaxLength(500);
            entity.Property(e => e.CorrelationId).HasColumnName("correlation_id").HasMaxLength(100);
            entity.Property(e => e.SessionId).HasColumnName("session_id").HasMaxLength(100);
            entity.Property(e => e.Timestamp).HasColumnName("timestamp");
            entity.Property(e => e.PartitionDate).HasColumnName("partition_date");

            entity.HasIndex(e => e.CompanyId).HasDatabaseName("ix_audit_log_company_id");
            entity.HasIndex(e => e.UserId).HasDatabaseName("ix_audit_log_user_id");
            entity.HasIndex(e => new { e.EntityType, e.EntityId }).HasDatabaseName("ix_audit_log_entity");
            entity.HasIndex(e => e.Timestamp).HasDatabaseName("ix_audit_log_timestamp");
            entity.HasIndex(e => e.CorrelationId).HasDatabaseName("ix_audit_log_correlation_id");
            entity.HasIndex(e => e.PartitionDate).HasDatabaseName("ix_audit_log_partition_date");
        });
    }
}
