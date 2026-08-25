using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Sqlite;

/// <summary>
///     DbContext para a outbox local do Agent/Collector (SQLite).
/// </summary>
public class SqliteOutboxDbContext : DbContext
{
    private readonly string _dbPath;

    public SqliteOutboxDbContext(string dbPath)
    {
        _dbPath = dbPath;
    }

    public DbSet<LocalMetadata> LocalMetadata => Set<LocalMetadata>();
    public DbSet<OutboxBatch> OutboxBatches => Set<OutboxBatch>();
    public DbSet<AppliedConfiguration> AppliedConfigurations => Set<AppliedConfiguration>();
    public DbSet<CommandReceipt> CommandReceipts => Set<CommandReceipt>();
    public DbSet<LocalEvent> LocalEvents => Set<LocalEvent>();

    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder.UseSqlite($"Data Source={_dbPath}");
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // LocalMetadata - chave/valor para estado local
        modelBuilder.Entity<LocalMetadata>(entity =>
        {
            entity.ToTable("local_metadata");
            entity.HasKey(e => e.Key);
            entity.Property(e => e.Key).HasColumnName("key");
            entity.Property(e => e.Value).HasColumnName("value");
            entity.Property(e => e.UpdatedAt).HasColumnName("updated_at");
        });

        // OutboxBatch - batches pendentes de envio
        modelBuilder.Entity<OutboxBatch>(entity =>
        {
            entity.ToTable("outbox_batches");
            entity.HasKey(e => e.BatchId);
            entity.Property(e => e.BatchId).HasColumnName("batch_id");
            entity.Property(e => e.Sequence).HasColumnName("sequence");
            entity.Property(e => e.ContentSha256).HasColumnName("content_sha256");
            entity.Property(e => e.CompressedPayload).HasColumnName("compressed_payload");
            entity.Property(e => e.CompressedSize).HasColumnName("compressed_size");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.Attempts).HasColumnName("attempts");
            entity.Property(e => e.CreatedAt).HasColumnName("created_at");
            entity.Property(e => e.NextAttemptAt).HasColumnName("next_attempt_at");
            entity.Property(e => e.LastError).HasColumnName("last_error");
            entity.Property(e => e.LastAttemptAt).HasColumnName("last_attempt_at");
            entity.Property(e => e.AckedAt).HasColumnName("acked_at");

            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.NextAttemptAt);
        });

        // AppliedConfiguration - controle de versões de configuração
        modelBuilder.Entity<AppliedConfiguration>(entity =>
        {
            entity.ToTable("applied_configurations");
            entity.HasKey(e => e.ConfigVersion);
            entity.Property(e => e.ConfigVersion).HasColumnName("config_version");
            entity.Property(e => e.ConfigHash).HasColumnName("config_hash");
            entity.Property(e => e.AppliedAt).HasColumnName("applied_at");
            entity.Property(e => e.ConfigJson).HasColumnName("config_json");
        });

        // CommandReceipt - receipts de comandos executados
        modelBuilder.Entity<CommandReceipt>(entity =>
        {
            entity.ToTable("command_receipts");
            entity.HasKey(e => e.CommandId);
            entity.Property(e => e.CommandId).HasColumnName("command_id");
            entity.Property(e => e.CommandType).HasColumnName("command_type");
            entity.Property(e => e.Status).HasColumnName("status");
            entity.Property(e => e.ResultJson).HasColumnName("result_json");
            entity.Property(e => e.ExecutedAt).HasColumnName("executed_at");
            entity.Property(e => e.RetryCount).HasColumnName("retry_count");
        });

        // LocalEvent - eventos locais para auditoria
        modelBuilder.Entity<LocalEvent>(entity =>
        {
            entity.ToTable("local_events");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).HasColumnName("id").ValueGeneratedOnAdd();
            entity.Property(e => e.EventType).HasColumnName("event_type");
            entity.Property(e => e.OccurredAt).HasColumnName("occurred_at");
            entity.Property(e => e.PayloadJson).HasColumnName("payload_json");
            entity.Property(e => e.Sequence).HasColumnName("sequence");
        });
    }

    public async Task EnsureCreatedAsync()
    {
        await Database.EnsureCreatedAsync();
    }
}

/// <summary>
///     Metadata local em formato chave/valor.
/// </summary>
public class LocalMetadata
{
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public DateTimeOffset UpdatedAt { get; set; }
}

/// <summary>
///     Batch pendente na outbox local.
/// </summary>
public class OutboxBatch
{
    public Guid BatchId { get; set; }
    public long Sequence { get; set; }
    public string ContentSha256 { get; set; } = string.Empty;
    public byte[] CompressedPayload { get; set; } = Array.Empty<byte>();
    public int CompressedSize { get; set; }
    public OutboxBatchStatus Status { get; set; } = OutboxBatchStatus.Pending;
    public int Attempts { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
    public DateTimeOffset NextAttemptAt { get; set; }
    public string? LastError { get; set; }
    public DateTimeOffset? LastAttemptAt { get; set; }
    public DateTimeOffset? AckedAt { get; set; }
}

/// <summary>
///     Status de um batch na outbox.
/// </summary>
public enum OutboxBatchStatus
{
    Pending = 0,
    Sending = 1,
    Acked = 2,
    Failed = 3
}

/// <summary>
///     Configuração aplicada localmente.
/// </summary>
public class AppliedConfiguration
{
    public long ConfigVersion { get; set; }
    public string ConfigHash { get; set; } = string.Empty;
    public DateTimeOffset AppliedAt { get; set; }
    public string ConfigJson { get; set; } = string.Empty;
}

/// <summary>
///     Receipt de comando executado.
/// </summary>
public class CommandReceipt
{
    public Guid CommandId { get; set; }
    public string CommandType { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ResultJson { get; set; }
    public DateTimeOffset ExecutedAt { get; set; }
    public int RetryCount { get; set; }
}

/// <summary>
///     Evento local para auditoria.
/// </summary>
public class LocalEvent
{
    public long Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; set; }
    public string? PayloadJson { get; set; }
    public long Sequence { get; set; }
}
