using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Edge.Collector.Classification;
using Inner.Monitoring.Edge.Collector.Concurrency;
using Inner.Monitoring.Edge.Collector.Discovery;
using Inner.Monitoring.Edge.Collector.Polling;
using Inner.Monitoring.Edge.Collector.Profiles;
using Inner.Monitoring.Edge.Collector.Security;
using Inner.Monitoring.Edge.Collector.Snmp;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector;

public sealed class EdgeCollectorHostedService : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<EdgeCollectorHostedService> _logger;
    private readonly CollectorOptions _options;

    public EdgeCollectorHostedService(
        IServiceProvider serviceProvider,
        ILogger<EdgeCollectorHostedService> logger,
        CollectorOptions options)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _options = options;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Inner Edge Collector starting... Version: {Version}",
            GetType().Assembly.GetName().Version);

        // Main service loop
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await RunDiscoveryCycleAsync(stoppingToken);
                await RunPollingCycleAsync(stoppingToken);

                // Wait for next cycle
                await Task.Delay(TimeSpan.FromSeconds(_options.CycleIntervalSeconds), stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in main service loop");
                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        _logger.LogInformation("Inner Edge Collector stopped");
    }

    private async Task RunDiscoveryCycleAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var pipeline = scope.ServiceProvider.GetRequiredService<IDiscoveryPipeline>();
        var credentialManager = scope.ServiceProvider.GetRequiredService<ICredentialManager>();

        _logger.LogInformation("Starting discovery cycle...");

        // Load ranges to discover (would come from API in real implementation)
        var ranges = await LoadNetworkRangesAsync(ct);

        foreach (var range in ranges)
        {
            if (ct.IsCancellationRequested)
                break;

            // Check if discovery is needed based on interval
            if (!IsDiscoveryNeeded(range))
            {
                _logger.LogDebug(
                    "Skipping discovery for {Range} (last: {Last})",
                    range.Name, range.LastDiscoveryAt);
                continue;
            }

            // Load credentials for this range
            var credentials = await LoadCredentialsForRangeAsync(range.Id, ct);

            if (credentials.Count == 0)
            {
                _logger.LogWarning(
                    "No credentials available for range {Range}",
                    range.Name);
                continue;
            }

            try
            {
                // Cache credentials
                foreach (var cred in credentials)
                {
                    credentialManager.CacheCredential(cred);
                }

                // Run discovery
                var discoveredDevices = await pipeline.DiscoverAsync(range, credentials, ct);

                // Save discovered devices
                await SaveDiscoveredDevicesAsync(discoveredDevices, ct);

                // Update range last discovery time
                await UpdateRangeDiscoveryTimeAsync(range.Id, ct);

                _logger.LogInformation(
                    "Discovery completed for {Range}: found {DeviceCount} devices",
                    range.Name, discoveredDevices.Count);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Discovery failed for range {Range}", range.Name);
            }
        }
    }

    private async Task RunPollingCycleAsync(CancellationToken ct)
    {
        using var scope = _serviceProvider.CreateScope();
        var pollingExecutor = scope.ServiceProvider.GetRequiredService<IPollingExecutor>();
        var concurrencyStats = scope.ServiceProvider.GetRequiredService<IConcurrencyLimiter>();

        _logger.LogDebug("Starting polling cycle...");

        // Load devices that need polling
        var devices = await LoadDevicesNeedingPollingAsync(ct);

        if (devices.Count == 0)
        {
            _logger.LogDebug("No devices need polling");
            return;
        }

        _logger.LogInformation(
            "Polling {DeviceCount} devices...",
            devices.Count);

        // Poll in batches
        var batchSize = 16; // Match concurrency limit
        for (var i = 0; i < devices.Count; i += batchSize)
        {
            if (ct.IsCancellationRequested)
                break;

            var batch = devices.Skip(i).Take(batchSize).ToList();
            var results = await pollingExecutor.PollBatchAsync(batch, ct);

            // Save metrics
            await SaveMetricsAsync(results, ct);
        }

        // Log stats
        var stats = concurrencyStats.GetStats();
        _logger.LogInformation(
            "Polling completed. Stats: probes={Probes}, polling={Polling}, rejected={Rejected}",
            stats.ActiveProbes, stats.ActivePolling, stats.TotalRejections);
    }

    private Task<IReadOnlyList<NetworkRange>> LoadNetworkRangesAsync(CancellationToken ct)
    {
        // In real implementation, this would load from database or API
        return Task.FromResult<IReadOnlyList<NetworkRange>>(Array.Empty<NetworkRange>());
    }

    private Task<IReadOnlyList<SnmpCredential>> LoadCredentialsForRangeAsync(Guid rangeId, CancellationToken ct)
    {
        // In real implementation, this would load from database
        return Task.FromResult<IReadOnlyList<SnmpCredential>>(Array.Empty<SnmpCredential>());
    }

    private Task<IReadOnlyList<DiscoveredDevice>> LoadDevicesNeedingPollingAsync(CancellationToken ct)
    {
        // In real implementation, this would load from database
        return Task.FromResult<IReadOnlyList<DiscoveredDevice>>(Array.Empty<DiscoveredDevice>());
    }

    private Task SaveDiscoveredDevicesAsync(IReadOnlyList<DiscoveredDevice> devices, CancellationToken ct)
    {
        // In real implementation, this would save to database
        return Task.CompletedTask;
    }

    private Task UpdateRangeDiscoveryTimeAsync(Guid rangeId, CancellationToken ct)
    {
        // In real implementation, this would update the database
        return Task.CompletedTask;
    }

    private Task SaveMetricsAsync(IReadOnlyList<PollingResult> results, CancellationToken ct)
    {
        // In real implementation, this would save metrics to database/outbox
        return Task.CompletedTask;
    }

    private static bool IsDiscoveryNeeded(NetworkRange range)
    {
        if (range.LastDiscoveryAt == null)
            return true;

        var nextDiscovery = range.LastDiscoveryAt.Value.AddMinutes(range.DiscoveryIntervalMinutes);
        return DateTimeOffset.UtcNow >= nextDiscovery;
    }
}
