using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Handler para comando outbox_status - retorna status da outbox.
/// </summary>
public sealed class OutboxStatusHandler : ICommandHandler
{
    private readonly ILogger<OutboxStatusHandler> _logger;
    private readonly Func<Task<OutboxStats>> _getOutboxStats;

    public string CommandType => "outbox_status";
    public string Description => "Retorna status da outbox";
    public int DefaultTimeoutSeconds => 10;

    public OutboxStatusHandler(
        ILogger<OutboxStatusHandler> logger,
        Func<Task<OutboxStats>> getOutboxStats)
    {
        _logger = logger;
        _getOutboxStats = getOutboxStats;
    }

    public async Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct)
    {
        var startTime = DateTimeOffset.UtcNow;

        try
        {
            var stats = await _getOutboxStats();

            var duration = DateTimeOffset.UtcNow - startTime;
            var result = new OutboxStatusResult
            {
                PendingCount = stats.PendingCount,
                ProcessingCount = stats.ProcessingCount,
                FailedCount = stats.FailedCount,
                OldestPendingAgeSeconds = stats.OldestPendingAgeSeconds,
                TotalPendingBytes = stats.TotalPendingBytes,
                OldestPendingTimestamp = stats.OldestPendingTimestamp
            };

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Succeeded,
                ResultJson = JsonSerializer.Serialize(result),
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            };
        }
        catch (Exception ex)
        {
            var duration = DateTimeOffset.UtcNow - startTime;
            _logger.LogError(ex, "Erro ao obter status da outbox");

            return new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Failed,
                ErrorCode = "OUTBOX_STATUS_ERROR",
                ErrorMessage = ex.Message,
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            };
        }
    }
}

/// <summary>
///     Estatísticas da outbox.
/// </summary>
public sealed class OutboxStats
{
    public required int PendingCount { get; init; }
    public required int ProcessingCount { get; init; }
    public required int FailedCount { get; init; }
    public required long OldestPendingAgeSeconds { get; init; }
    public required long TotalPendingBytes { get; init; }
    public required DateTimeOffset OldestPendingTimestamp { get; init; }
}
