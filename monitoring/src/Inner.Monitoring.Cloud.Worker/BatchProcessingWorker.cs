using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Worker;

/// <summary>
///     Worker para processar jobs de batches do banco de dados.
///     Usa FOR UPDATE SKIP LOCKED para evitar contenção.
/// </summary>
public class BatchProcessingWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<BatchProcessingWorker> _logger;
    private readonly WorkerConfig _config;

    private const int LeaseDurationSeconds = 60;
    private const int BatchSize = 10;

    public BatchProcessingWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<BatchProcessingWorker> logger,
        WorkerConfig? config = null)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _config = config ?? new WorkerConfig();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("BatchProcessingWorker iniciado");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchesAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no loop de processamento");
                await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);
            }
        }

        _logger.LogInformation("BatchProcessingWorker encerrado");
    }

    private async Task ProcessBatchesAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

        // Buscar jobs pendentes com FOR UPDATE SKIP LOCKED
        var jobs = await db.ProcessingJobs
            .FromSqlRaw(@"
                SELECT pj.*
                FROM monitoring.processing_jobs pj
                WHERE pj.status IN ('Pending', 'Retrying')
                  AND pj.available_at <= NOW()
                  AND (pj.lease_expires_at IS NULL OR pj.lease_expires_at < NOW())
                ORDER BY pj.priority, pj.available_at
                LIMIT {0}
                FOR UPDATE SKIP LOCKED", BatchSize)
            .Include(j => j)
            .ToListAsync(cancellationToken);

        if (jobs.Count == 0)
        {
            // Aguardar antes de verificar novamente
            await Task.Delay(TimeSpan.FromSeconds(_config.PollIntervalSeconds), cancellationToken);
            return;
        }

        _logger.LogDebug("Encontrados {Count} jobs para processar", jobs.Count);

        foreach (var job in jobs)
        {
            await ProcessJobAsync(job, db, cancellationToken);
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    private async Task ProcessJobAsync(
        ProcessingJob job,
        MonitoringDbContext db,
        CancellationToken cancellationToken)
    {
        var workerId = _config.WorkerId;

        try
        {
            // Tentar adquirir lease
            if (!TryAcquireLease(job, workerId))
            {
                return;
            }

            // Buscar batch
            var batch = await db.IngestBatches
                .FirstOrDefaultAsync(b => b.Id == job.BatchRowId, cancellationToken);

            if (batch == null)
            {
                _logger.LogWarning("Batch {BatchId} não encontrado para job {JobId}", job.BatchRowId, job.Id);
                job.MarkDeadLetter("BATCH_NOT_FOUND", "Batch associated with job was not found");
                return;
            }

            // Marcar batch como processando
            batch.MarkProcessing();

            // Processar o batch
            var result = await ProcessBatchAsync(batch, cancellationToken);

            if (result.IsSuccess)
            {
                batch.MarkProcessed();
                job.MarkCompleted();

                _logger.LogInformation(
                    "Batch {BatchId} processado com sucesso (job={JobId}, attempts={Attempts})",
                    batch.BatchId, job.Id, job.Attempts);

                // Atualizar cursor de sequência
                await UpdateSequenceCursorAsync(db, batch.SourceId, batch.Sequence, cancellationToken);
            }
            else if (result.CanRetry && job.CanRetry)
            {
                var errorCode = result.ErrorCode ?? "UNKNOWN";
                batch.MarkRetrying(errorCode, result.ErrorDetail);
                job.MarkRetrying(errorCode, result.ErrorDetail);

                _logger.LogWarning(
                    "Batch {BatchId} falhou, retry agendado (job={JobId}, attempt={Attempt}, next={NextAttempt})",
                    batch.BatchId, job.Id, job.Attempts, job.AvailableAt);
            }
            else
            {
                var errorCode = result.ErrorCode ?? "UNKNOWN";
                batch.MarkDeadLetter(errorCode, result.ErrorDetail);
                job.MarkDeadLetter(errorCode, result.ErrorDetail);

                _logger.LogError(
                    "Batch {BatchId} movido para dead letter (job={JobId}, attempts={Attempts}): {Error}",
                    batch.BatchId, job.Id, job.Attempts, result.ErrorDetail);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar job {JobId}", job.Id);

            if (job.CanRetry)
            {
                job.MarkRetrying("PROCESSING_ERROR", ex.Message);
            }
            else
            {
                job.MarkDeadLetter("PROCESSING_ERROR", ex.Message);
            }
        }
    }

    private bool TryAcquireLease(ProcessingJob job, string workerId)
    {
        return job.TryAcquire(workerId, TimeSpan.FromSeconds(LeaseDurationSeconds));
    }

    private async Task<ProcessingResult> ProcessBatchAsync(IngestBatch batch, CancellationToken cancellationToken)
    {
        try
        {
            // Parse do payload
            if (batch.Payload == null)
            {
                return ProcessingResult.Failed("EMPTY_PAYLOAD", "Batch payload is empty");
            }

            var payloadJson = batch.Payload.RootElement.GetRawText();

            // Aqui seria a lógica de processamento real:
            // - Parse dos registros
            // - Upsert de assets
            // - Inserção de métricas
            // - Processamento de eventos
            // - etc.

            // Por enquanto, apenas simulamos o processamento
            await Task.Delay(10, cancellationToken); // Simular processamento

            return ProcessingResult.Succeeded();
        }
        catch (Exception ex)
        {
            return ProcessingResult.Failed("PROCESSING_ERROR", ex.Message);
        }
    }

    private async Task UpdateSequenceCursorAsync(
        MonitoringDbContext db,
        Guid sourceId,
        long sequence,
        CancellationToken cancellationToken)
    {
        try
        {
            // Verificar se a sequência é contígua
            var cursor = await db.SourceSequenceCursors
                .FirstOrDefaultAsync(c => c.SourceId == sourceId, cancellationToken);

            if (cursor == null)
            {
                cursor = SourceSequenceCursor.Create(sourceId);
                db.SourceSequenceCursors.Add(cursor);
            }

            cursor.UpdateReceived(sequence);

            // Verificar se a sequência anterior foi confirmada
            if (sequence == cursor.HighestContiguousSequence + 1)
            {
                cursor.UpdateContiguous(sequence);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao atualizar cursor de sequência para source {SourceId}", sourceId);
        }
    }
}

/// <summary>
///     Resultado do processamento de um batch.
/// </summary>
internal record ProcessingResult(bool IsSuccess, bool CanRetry, string? ErrorCode, string? ErrorDetail)
{
    public static ProcessingResult Succeeded() => new(true, false, null, null);
    public static ProcessingResult Failed(string errorCode, string errorDetail, bool canRetry = true) =>
        new(false, canRetry, errorCode, errorDetail);
}

/// <summary>
///     Configuração do worker.
/// </summary>
public class WorkerConfig
{
    public string WorkerId { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public int PollIntervalSeconds { get; set; } = 5;
    public int LeaseDurationSeconds { get; set; } = 60;
    public int MaxAttempts { get; set; } = 10;
}
