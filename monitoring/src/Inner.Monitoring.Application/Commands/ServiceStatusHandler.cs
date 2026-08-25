using System.Diagnostics;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Commands;

/// <summary>
///     Handler para comando service_status - retorna status do serviço.
/// </summary>
public sealed class ServiceStatusHandler : ICommandHandler
{
    private readonly ILogger<ServiceStatusHandler> _logger;
    private readonly DateTimeOffset _serviceStartTime;
    private readonly string _serviceName;

    public string CommandType => "service_status";
    public string Description => "Retorna status do serviço";
    public int DefaultTimeoutSeconds => 5;

    public ServiceStatusHandler(
        ILogger<ServiceStatusHandler> logger,
        string serviceName,
        DateTimeOffset serviceStartTime)
    {
        _logger = logger;
        _serviceName = serviceName;
        _serviceStartTime = serviceStartTime;
    }

    public Task<CommandResult> ExecuteAsync(CommandEnvelope envelope, CancellationToken ct)
    {
        var startTime = DateTimeOffset.UtcNow;

        try
        {
            var process = Process.GetCurrentProcess();
            var cpuTime = process.TotalProcessorTime;
            var elapsed = process.StartTime - DateTimeOffset.UtcNow;
            var cpuUsage = elapsed.TotalMilliseconds > 0
                ? cpuTime.TotalMilliseconds / elapsed.TotalMilliseconds * 100
                : 0;

            var result = new ServiceStatusResult
            {
                ServiceName = _serviceName,
                State = ServiceState.Running,
                StartedAt = _serviceStartTime,
                Uptime = DateTimeOffset.UtcNow - _serviceStartTime,
                CpuUsagePercent = Math.Min(100, Math.Max(0, cpuUsage)),
                MemoryUsageBytes = process.WorkingSet64,
                Metrics = new Dictionary<string, MetricValue>
                {
                    ["thread_count"] = new MetricValue
                    {
                        Value = process.Threads.Count,
                        Unit = "count",
                        SampledAt = DateTimeOffset.UtcNow
                    },
                    ["handle_count"] = new MetricValue
                    {
                        Value = process.HandleCount,
                        Unit = "count",
                        SampledAt = DateTimeOffset.UtcNow
                    },
                    ["private_bytes_mb"] = new MetricValue
                    {
                        Value = process.PrivateMemorySize64 / 1024.0 / 1024.0,
                        Unit = "MB",
                        SampledAt = DateTimeOffset.UtcNow
                    }
                },
                Warnings = GetWarnings(process)
            };

            var duration = DateTimeOffset.UtcNow - startTime;

            return Task.FromResult(new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Succeeded,
                ResultJson = JsonSerializer.Serialize(result),
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            });
        }
        catch (Exception ex)
        {
            var duration = DateTimeOffset.UtcNow - startTime;
            _logger.LogError(ex, "Erro ao obter status do serviço");

            return Task.FromResult(new CommandResult
            {
                CommandId = envelope.CommandId,
                Status = CommandStatus.Failed,
                ErrorCode = "SERVICE_STATUS_ERROR",
                ErrorMessage = ex.Message,
                CompletedAt = DateTimeOffset.UtcNow,
                Duration = duration,
                ShouldRetry = false
            });
        }
    }

    private static List<string> GetWarnings(Process process)
    {
        var warnings = new List<string>();

        // High memory warning
        var memoryGb = process.WorkingSet64 / 1024.0 / 1024.0 / 1024.0;
        if (memoryGb > 2)
        {
            warnings.Add($"Alto uso de memória: {memoryGb:F1} GB");
        }

        // High thread count warning
        if (process.Threads.Count > 100)
        {
            warnings.Add($"Alta contagem de threads: {process.Threads.Count}");
        }

        return warnings;
    }
}
