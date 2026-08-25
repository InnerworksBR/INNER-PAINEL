using System.Text.Json;
using Inner.Monitoring.Contracts.Collectors;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Handler para comando collect_now - força coleta imediata.
/// </summary>
public sealed class CollectNowHandler : ICommandHandler
{
    private readonly IEnumerable<IObservationCollector> _collectors;
    private readonly ILogger<CollectNowHandler> _logger;

    public string CommandType => "collect_now";
    public string Description => "Forca coleta imediata de metricas";
    public int DefaultTimeoutSeconds => 300;

    public CollectNowHandler(
        IEnumerable<IObservationCollector> collectors,
        ILogger<CollectNowHandler> logger)
    {
        _collectors = collectors;
        _logger = logger;
    }

    public async Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct)
    {
        var startTime = DateTimeOffset.UtcNow;
        var collectorsRun = new List<string>();
        var collectorsSkipped = new List<string>();
        var totalRecords = 0;

        try
        {
            var context = new CollectionContext
            {
                SourceId = envelope.SourceId,
                SourceVersion = "1.0.0",
                Hostname = Environment.MachineName,
                CollectedAt = startTime,
                LocalAssetId = GetLocalAssetId(),
                MachineFingerprint = GetMachineFingerprint(),
                CancellationToken = ct
            };

            foreach (var collector in _collectors.OrderBy(c => c.Priority))
            {
                try
                {
                    _logger.LogInformation("Executando coleta forcada: {Collector}", collector.Name);

                    var result = await collector.CollectAsync(context, ct);

                    if (result.Success)
                    {
                        totalRecords += result.Records.Count;
                        collectorsRun.Add(collector.Name);
                    }
                    else
                    {
                        collectorsSkipped.Add($"{collector.Name}:{result.ErrorCode}");
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Erro na coleta {Collector}", collector.Name);
                    collectorsSkipped.Add($"{collector.Name}:{ex.GetType().Name}");
                }
            }

            var duration = DateTimeOffset.UtcNow - startTime;
            var result_ = new CollectNowResult
            {
                BatchId = Guid.NewGuid(),
                RecordsCollected = totalRecords,
                CollectedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                CollectorsRun = collectorsRun,
                CollectorsSkipped = collectorsSkipped
            };

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Succeeded,
                ResultJson = JsonSerializer.Serialize(result_),
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            };
        }
        catch (Exception ex)
        {
            var duration = DateTimeOffset.UtcNow - startTime;
            _logger.LogError(ex, "Erro ao executar collect_now");

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Failed,
                ErrorCode = "COLLECT_ERROR",
                ErrorMessage = ex.Message,
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = true
            };
        }
    }

    private static string GetLocalAssetId()
    {
        return Environment.MachineName;
    }

    private static string GetMachineFingerprint()
    {
        return Environment.MachineName;
    }
}
