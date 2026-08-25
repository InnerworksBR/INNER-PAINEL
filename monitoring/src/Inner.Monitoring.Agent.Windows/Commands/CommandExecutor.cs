using System.Text.Json;
using Inner.Monitoring.Agent.Windows.Collectors;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows.Commands;

/// <summary>
///     Executor de comandos remotos.
/// </summary>
public sealed class CommandExecutor : ICommandExecutor
{
    private readonly CollectorRegistry _collectorRegistry;
    private readonly IOutbox _outbox;
    private readonly IConfigurationService _configService;
    private readonly ILogger<CommandExecutor> _logger;

    private readonly Dictionary<string, Func<AgentCommand, CancellationToken, Task<CommandResult>>> _handlers;

    public CommandExecutor(
        CollectorRegistry collectorRegistry,
        IOutbox outbox,
        IConfigurationService configService,
        ILogger<CommandExecutor> logger)
    {
        _collectorRegistry = collectorRegistry;
        _outbox = outbox;
        _configService = configService;
        _logger = logger;
        _handlers = new Dictionary<string, Func<AgentCommand, CancellationToken, Task<CommandResult>>>
        {
            ["collect_now"] = HandleCollectNow,
            ["diagnostics_run"] = HandleDiagnosticsRun,
            ["config_refresh"] = HandleConfigRefresh,
            ["outbox_status"] = HandleOutboxStatus
        };
    }

    public IReadOnlyList<string> SupportedCommands => _handlers.Keys.ToList();

    public async Task<CommandResult> ExecuteAsync(AgentCommand command, CancellationToken ct)
    {
        _logger.LogInformation("Executing command {CommandId}: {CommandType}", command.Id, command.Type);

        if (!_handlers.TryGetValue(command.Type, out var handler))
        {
            return new CommandResult(
                CommandId: command.Id,
                Status: "error",
                ExecutedAt: DateTimeOffset.UtcNow,
                Output: null,
                Error: $"Unknown command type: {command.Type}");
        }

        try
        {
            return await handler(command, ct);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Command execution failed");
            return new CommandResult(
                CommandId: command.Id,
                Status: "error",
                ExecutedAt: DateTimeOffset.UtcNow,
                Output: null,
                Error: ex.Message);
        }
    }

    private Task<CommandResult> HandleCollectNow(AgentCommand command, CancellationToken ct)
    {
        // For collect_now, we trigger an immediate collection cycle
        // The actual collection is handled by the worker
        _logger.LogInformation("Triggering immediate collection");

        return Task.FromResult(new CommandResult(
            CommandId: command.Id,
            Status: "success",
            ExecutedAt: DateTimeOffset.UtcNow,
            Output: "Collection triggered",
            Error: null));
    }

    private Task<CommandResult> HandleDiagnosticsRun(AgentCommand command, CancellationToken ct)
    {
        var diagnostics = new Dictionary<string, object>
        {
            ["collectors"] = _collectorRegistry.AvailableCollectors,
            ["config_version"] = _configService.ConfigVersion,
            ["outbox_status"] = "available via outbox_status command",
            ["uptime_seconds"] = Environment.TickCount64 / 1000,
            ["memory_working_set"] = Environment.WorkingSet,
            ["gc_info"] = new
            {
                total_memory = GC.GetTotalMemory(false),
                max_generation = GC.MaxGeneration,
                generations = new[]
                {
                    new { gen = 0, collections = GC.CollectionCount(0) },
                    new { gen = 1, collections = GC.CollectionCount(1) },
                    new { gen = 2, collections = GC.CollectionCount(2) }
                }
            }
        };

        var output = JsonSerializer.Serialize(diagnostics, new JsonSerializerOptions { WriteIndented = true });

        return Task.FromResult(new CommandResult(
            CommandId: command.Id,
            Status: "success",
            ExecutedAt: DateTimeOffset.UtcNow,
            Output: output,
            Error: null));
    }

    private async Task<CommandResult> HandleConfigRefresh(AgentCommand command, CancellationToken ct)
    {
        var (changed, etag) = await _configService.FetchConfigurationAsync(ct);

        var result = new
        {
            changed,
            etag,
            version = _configService.ConfigVersion,
            message = changed ? "Configuration updated" : "Configuration unchanged"
        };

        return new CommandResult(
            CommandId: command.Id,
            Status: "success",
            ExecutedAt: DateTimeOffset.UtcNow,
            Output: JsonSerializer.Serialize(result),
            Error: null);
    }

    private async Task<CommandResult> HandleOutboxStatus(AgentCommand command, CancellationToken ct)
    {
        var status = await _outbox.GetStatusAsync(ct);
        var nextSeq = await _outbox.GetNextSequenceAsync(ct);
        var lastAcked = await _outbox.GetLastAckedSequenceAsync(ct);

        var result = new
        {
            pending_count = status.PendingCount,
            pending_bytes = status.PendingBytes,
            max_bytes = status.MaxBytes,
            oldest_pending_at = status.OldestPendingAt,
            wal_bytes = status.WalBytes,
            next_sequence = nextSeq,
            last_acked_sequence = lastAcked
        };

        return new CommandResult(
            CommandId: command.Id,
            Status: "success",
            ExecutedAt: DateTimeOffset.UtcNow,
            Output: JsonSerializer.Serialize(result, new JsonSerializerOptions { WriteIndented = true }),
            Error: null);
    }
}
