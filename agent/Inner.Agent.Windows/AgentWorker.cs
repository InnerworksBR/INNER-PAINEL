using Inner.Agent.Windows.Collectors;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Inner.Agent.Windows;

public sealed class AgentWorker(
    IHostMetricsCollector hostCollector,
    IOptions<AgentOptions> options,
    ILogger<AgentWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Inner Hyper-V agent started on {Hostname}", Environment.MachineName);
        var interval = TimeSpan.FromSeconds(Math.Clamp(options.Value.CollectionIntervalSeconds, 15, 3600));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var host = await hostCollector.CollectAsync(stoppingToken);
                logger.LogDebug("Collected host metrics for {Hostname}: CPU {CpuPercent:F1}%, memory {MemoryPercent:F1}%",
                    host.Hostname, host.CpuPercent, host.MemoryPercent);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception error)
            {
                logger.LogError(error, "Host metric collection failed");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }
}
