using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Infrastructure.Sqlite;

/// <summary>
///     Serviço para gerenciar a outbox local (persistir batch, marcar ack, retry com backoff + jitter).
/// </summary>
public class OutboxService
{
    private readonly SqliteOutboxDbContext _db;
    private readonly ILogger<OutboxService> _logger;
    private readonly string _instanceId;

    // Configurações
    private const int MaxAttempts = 10;
    private const int BaseBackoffSeconds = 5;
    private const int MaxBackoffSeconds = 300;

    public OutboxService(SqliteOutboxDbContext db, ILogger<OutboxService> logger, string instanceId)
    {
        _db = db;
        _logger = logger;
        _instanceId = instanceId;
    }

    /// <summary>
    ///     Persiste um novo batch na outbox.
    /// </summary>
    public async Task<OutboxBatch> PersistBatchAsync(
        Guid batchId,
        long sequence,
        byte[] payload,
        CancellationToken cancellationToken = default)
    {
        // Comprimir payload
        var compressedPayload = CompressPayload(payload);
        var contentSha256 = ComputeSha256(payload);

        var batch = new OutboxBatch
        {
            BatchId = batchId,
            Sequence = sequence,
            ContentSha256 = contentSha256,
            CompressedPayload = compressedPayload,
            CompressedSize = compressedPayload.Length,
            Status = OutboxBatchStatus.Pending,
            Attempts = 0,
            CreatedAt = DateTimeOffset.UtcNow,
            NextAttemptAt = DateTimeOffset.UtcNow
        };

        _db.OutboxBatches.Add(batch);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogDebug(
            "Batch {BatchId} persistido na outbox (seq={Sequence}, size={Size} bytes)",
            batchId, sequence, compressedPayload.Length);

        return batch;
    }

    /// <summary>
    ///     Marca um batch como enviado (em progresso).
    /// </summary>
    public async Task MarkSendingAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        var batch = await _db.OutboxBatches
            .FirstOrDefaultAsync(b => b.BatchId == batchId, cancellationToken);

        if (batch != null)
        {
            batch.Status = OutboxBatchStatus.Sending;
            batch.Attempts++;
            batch.LastAttemptAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);
        }
    }

    /// <summary>
    ///     Marca um batch como confirmado (ACK).
    /// </summary>
    public async Task MarkAckedAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        var batch = await _db.OutboxBatches
            .FirstOrDefaultAsync(b => b.BatchId == batchId, cancellationToken);

        if (batch != null)
        {
            batch.Status = OutboxBatchStatus.Acked;
            batch.AckedAt = DateTimeOffset.UtcNow;
            await _db.SaveChangesAsync(cancellationToken);

            _logger.LogInformation(
                "Batch {BatchId} confirmado (seq={Sequence}, attempts={Attempts})",
                batchId, batch.Sequence, batch.Attempts);

            // Limpar batches muito antigos
            await CleanupOldBatchesAsync(cancellationToken);
        }
    }

    /// <summary>
    ///     Marca um batch como falhou e agenda retry com backoff exponencial + jitter.
    /// </summary>
    public async Task MarkFailedAsync(
        Guid batchId,
        string errorCode,
        string? errorDetail = null,
        CancellationToken cancellationToken = default)
    {
        var batch = await _db.OutboxBatches
            .FirstOrDefaultAsync(b => b.BatchId == batchId, cancellationToken);

        if (batch == null) return;

        var errorMessage = string.IsNullOrEmpty(errorDetail)
            ? errorCode
            : $"{errorCode}: {errorDetail}";

        if (batch.Attempts >= MaxAttempts)
        {
            batch.Status = OutboxBatchStatus.Failed;
            batch.LastError = $"MAX_ATTEMPTS_EXCEEDED: {errorMessage}";
            _logger.LogWarning(
                "Batch {BatchId} marcado como falho definitivo após {Attempts} tentativas",
                batchId, batch.Attempts);
        }
        else
        {
            batch.Status = OutboxBatchStatus.Pending;
            batch.LastError = errorMessage;

            // Backoff exponencial: 5s, 10s, 20s, 40s, 80s, 160s, 300s (max)
            var backoffSeconds = Math.Min(MaxBackoffSeconds, BaseBackoffSeconds * (int)Math.Pow(2, batch.Attempts - 1));

            // Adicionar jitter de +/- 20%
            var jitterRange = backoffSeconds * 0.2;
            var jitter = Random.Shared.NextDouble() * jitterRange * 2 - jitterRange;
            var actualBackoff = TimeSpan.FromSeconds(backoffSeconds + jitter);

            batch.NextAttemptAt = DateTimeOffset.UtcNow.Add(actualBackoff);

            _logger.LogWarning(
                "Batch {BatchId} falhou (attempt {Attempt}/{MaxAttempts}), retry em {BackoffSeconds:F1}s: {Error}",
                batchId, batch.Attempts, MaxAttempts, actualBackoff.TotalSeconds, errorMessage);
        }

        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    ///     Obtém batches pendentes para envio.
    /// </summary>
    public async Task<IReadOnlyList<OutboxBatch>> GetPendingBatchesAsync(
        int limit = 10,
        CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;

        return await _db.OutboxBatches
            .Where(b => b.Status == OutboxBatchStatus.Pending && b.NextAttemptAt <= now)
            .OrderBy(b => b.Sequence)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    ///     Obtém um batch específico.
    /// </summary>
    public async Task<OutboxBatch?> GetBatchAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        return await _db.OutboxBatches
            .FirstOrDefaultAsync(b => b.BatchId == batchId, cancellationToken);
    }

    /// <summary>
    ///     Verifica se um batch já foi confirmado.
    /// </summary>
    public async Task<bool> IsBatchAckedAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        return await _db.OutboxBatches
            .AnyAsync(b => b.BatchId == batchId && b.Status == OutboxBatchStatus.Acked, cancellationToken);
    }

    /// <summary>
    ///     Obtém estatísticas da outbox.
    /// </summary>
    public async Task<OutboxStats> GetStatsAsync(CancellationToken cancellationToken = default)
    {
        var stats = await _db.OutboxBatches
            .GroupBy(_ => 1)
            .Select(g => new
            {
                PendingCount = g.Count(b => b.Status == OutboxBatchStatus.Pending),
                PendingBytes = g.Where(b => b.Status == OutboxBatchStatus.Pending)
                    .Sum(b => (long?)b.CompressedSize) ?? 0,
                OldestPendingAt = g.Where(b => b.Status == OutboxBatchStatus.Pending)
                    .Min(b => (DateTimeOffset?)b.CreatedAt),
                FailedCount = g.Count(b => b.Status == OutboxBatchStatus.Failed)
            })
            .FirstOrDefaultAsync(cancellationToken);

        return new OutboxStats(
            stats?.PendingCount ?? 0,
            stats?.PendingBytes ?? 0,
            stats?.OldestPendingAt,
            stats?.FailedCount ?? 0);
    }

    /// <summary>
    ///     Obtém a última sequência confirmada.
    /// </summary>
    public async Task<long?> GetLastAckedSequenceAsync(CancellationToken cancellationToken = default)
    {
        return await _db.OutboxBatches
            .Where(b => b.Status == OutboxBatchStatus.Acked)
            .MaxAsync(b => (long?)b.Sequence, cancellationToken);
    }

    /// <summary>
    ///     Obtém a próxima sequência a ser criada.
    /// </summary>
    public async Task<long> GetNextSequenceAsync(CancellationToken cancellationToken = default)
    {
        var maxSequence = await _db.OutboxBatches
            .MaxAsync(b => (long?)b.Sequence, cancellationToken);

        return (maxSequence ?? 0) + 1;
    }

    /// <summary>
    ///     Salva uma configuração aplicada.
    /// </summary>
    public async Task SaveAppliedConfigurationAsync(
        long configVersion,
        string configHash,
        string configJson,
        CancellationToken cancellationToken = default)
    {
        var applied = new AppliedConfiguration
        {
            ConfigVersion = configVersion,
            ConfigHash = configHash,
            ConfigJson = configJson,
            AppliedAt = DateTimeOffset.UtcNow
        };

        _db.AppliedConfigurations.Add(applied);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Configuração {ConfigVersion} aplicada localmente", configVersion);
    }

    /// <summary>
    ///     Obtém a última configuração aplicada.
    /// </summary>
    public async Task<AppliedConfiguration?> GetLastAppliedConfigAsync(CancellationToken cancellationToken = default)
    {
        return await _db.AppliedConfigurations
            .OrderByDescending(c => c.ConfigVersion)
            .FirstOrDefaultAsync(cancellationToken);
    }

    /// <summary>
    ///     Salva receipt de comando.
    /// </summary>
    public async Task SaveCommandReceiptAsync(
        Guid commandId,
        string commandType,
        string status,
        object? result = null,
        CancellationToken cancellationToken = default)
    {
        var receipt = new CommandReceipt
        {
            CommandId = commandId,
            CommandType = commandType,
            Status = status,
            ResultJson = result != null ? JsonSerializer.Serialize(result) : null,
            ExecutedAt = DateTimeOffset.UtcNow
        };

        _db.CommandReceipts.Add(receipt);
        await _db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    ///     Verifica se um comando já foi executado.
    /// </summary>
    public async Task<bool> IsCommandExecutedAsync(Guid commandId, CancellationToken cancellationToken = default)
    {
        return await _db.CommandReceipts
            .AnyAsync(c => c.CommandId == commandId, cancellationToken);
    }

    /// <summary>
    ///     Salva evento local.
    /// </summary>
    public async Task SaveLocalEventAsync(
        string eventType,
        object? payload = null,
        CancellationToken cancellationToken = default)
    {
        var nextSequence = await GetNextEventSequenceAsync(cancellationToken);

        var evt = new LocalEvent
        {
            EventType = eventType,
            OccurredAt = DateTimeOffset.UtcNow,
            PayloadJson = payload != null ? JsonSerializer.Serialize(payload) : null,
            Sequence = nextSequence
        };

        _db.LocalEvents.Add(evt);
        await _db.SaveChangesAsync(cancellationToken);
    }

    private async Task<long> GetNextEventSequenceAsync(CancellationToken cancellationToken)
    {
        var maxSequence = await _db.LocalEvents
            .MaxAsync(e => (long?)e.Sequence, cancellationToken);

        return (maxSequence ?? 0) + 1;
    }

    private async Task CleanupOldBatchesAsync(CancellationToken cancellationToken)
    {
        // Remove batches ACKados com mais de 24h
        var cutoff = DateTimeOffset.UtcNow.AddHours(-24);

        var oldBatches = await _db.OutboxBatches
            .Where(b => b.Status == OutboxBatchStatus.Acked && b.AckedAt < cutoff)
            .ToListAsync(cancellationToken);

        if (oldBatches.Count > 0)
        {
            _db.OutboxBatches.RemoveRange(oldBatches);
            await _db.SaveChangesAsync(cancellationToken);
            _logger.LogDebug("Limpeza: {Count} batches antigos removidos", oldBatches.Count);
        }
    }

    private static byte[] CompressPayload(byte[] payload)
    {
        using var output = new MemoryStream();
        output.WriteByte(0); // Magic byte para identificar formato

        using (var gzip = new GZipStream(output, CompressionLevel.Fastest, leaveOpen: true))
        {
            gzip.Write(payload, 0, payload.Length);
        }

        return output.ToArray();
    }

    private static string ComputeSha256(byte[] payload)
    {
        var hash = SHA256.HashData(payload);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }

    public static byte[] DecompressPayload(byte[] compressedPayload)
    {
        if (compressedPayload.Length == 0 || compressedPayload[0] != 0)
        {
            throw new InvalidDataException("Formato de payload comprimido inválido");
        }

        using var input = new MemoryStream(compressedPayload, 1, compressedPayload.Length - 1);
        using var gzip = new GZipStream(input, CompressionMode.Decompress);
        using var output = new MemoryStream();

        gzip.CopyTo(output);
        return output.ToArray();
    }
}

/// <summary>
///     Estatísticas da outbox.
/// </summary>
public record OutboxStats(
    int PendingCount,
    long PendingBytes,
    DateTimeOffset? OldestPendingAt,
    int FailedCount);
