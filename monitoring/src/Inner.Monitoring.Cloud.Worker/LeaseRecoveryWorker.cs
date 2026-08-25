using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Worker;

/// <summary>
///     Worker para recuperar leases expirados e reprogramar jobs falhados.
/// </summary>
public class LeaseRecoveryWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<LeaseRecoveryWorker> _logger;
    private readonly WorkerConfig _config;

    private const int RecoveryWindowMinutes = 10;

    public LeaseRecoveryWorker(
        IServiceScopeFactory scopeFactory,
        ILogger<LeaseRecoveryWorker> logger,
        WorkerConfig? config = null)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _config = config ?? new WorkerConfig();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("LeaseRecoveryWorker iniciado");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RecoverExpiredLeasesAsync(stoppingToken);
                await CheckDeadLettersAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no loop de recuperação de leases");
            }

            // Verificar a cada 30 segundos
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }

        _logger.LogInformation("LeaseRecoveryWorker encerrado");
    }

    /// <summary>
    ///     Recupera jobs com leases expirados.
    /// </summary>
    private async Task RecoverExpiredLeasesAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

        var now = DateTimeOffset.UtcNow;
        var recoveryThreshold = now.AddMinutes(-RecoveryWindowMinutes);

        // Buscar jobs com lease expirado
        var expiredJobs = await db.ProcessingJobs
            .FromSqlRaw(@"
                SELECT pj.*
                FROM monitoring.processing_jobs pj
                WHERE pj.status = 'Leased'
                  AND pj.lease_expires_at < NOW()
                  AND pj.lease_expires_at > NOW() - INTERVAL '{0} minutes'
                FOR UPDATE", RecoveryWindowMinutes)
            .ToListAsync(cancellationToken);

        if (expiredJobs.Count == 0)
        {
            return;
        }

        _logger.LogInformation(
            "Encontrados {Count} jobs com lease expirado para recuperação",
            expiredJobs.Count);

        foreach (var job in expiredJobs)
        {
            try
            {
                // Verificar se o worker original ainda está processando
                var workerStillActive = await IsWorkerActiveAsync(job.LeasedBy, cancellationToken);

                if (!workerStillActive)
                {
                    // Worker inativo, recuperar o lease
                    job.RecoverLease();

                    // Marcar batch também
                    var batch = await db.IngestBatches
                        .FirstOrDefaultAsync(b => b.Id == job.BatchRowId, cancellationToken);

                    if (batch != null && batch.Status == BatchStatus.Processing)
                    {
                        batch.MarkRetrying("LEASE_RECOVERED", "Lease expired, worker did not respond");
                    }

                    _logger.LogWarning(
                        "Lease do job {JobId} recuperado (worker={Worker}, attempts={Attempts})",
                        job.Id, "recovered", job.Attempts);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao recuperar lease do job {JobId}", job.Id);
            }
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    ///     Verifica jobs em dead letter para possível retry.
    /// </summary>
    private async Task CheckDeadLettersAsync(CancellationToken cancellationToken)
    {
        using var scope = _scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<MonitoringDbContext>();

        // Opcional: tentar reprocessar batches em dead letter após algum tempo
        // Isso é útil para erros transitórios que podem ter se resolvido
        var deadLetterCutoff = DateTimeOffset.UtcNow.AddHours(-24);

        var deadLetters = await db.IngestBatches
            .Where(b =>
                b.Status == BatchStatus.DeadLetter &&
                b.ProcessedAt == null)
            .Take(100)
            .ToListAsync(cancellationToken);

        foreach (var batch in deadLetters)
        {
            // Lógica opcional: reativar dead letters após certo tempo
            // Por enquanto, apenas logamos
            _logger.LogDebug(
                "Batch {BatchId} em dead letter (error: {ErrorCode})",
                batch.BatchId, batch.LastErrorCode);
        }
    }

    /// <summary>
    ///     Verifica se um worker ainda está ativo.
    ///     Em uma implementação real, isso verificaria Redis ou outro mecanismo de heartbeats.
    /// </summary>
    private Task<bool> IsWorkerActiveAsync(string? workerId, CancellationToken cancellationToken)
    {
        // Por enquanto, consideramos todos os workers ativos
        // Em produção, verificaríamos em Redis/Kubernetes/etc.
        return Task.FromResult(false);
    }
}
