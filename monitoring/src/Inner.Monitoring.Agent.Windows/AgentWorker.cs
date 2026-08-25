using System.Net.Http.Json;
using Inner.Monitoring.Agent.Windows.Collectors;
using Inner.Monitoring.Agent.Windows.Outbox;
using Inner.Monitoring.Agent.Windows.Services;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Background service principal do Agent.
/// </summary>
public sealed class AgentWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<AgentWorker> _logger;
    private readonly CollectorRegistry _collectorRegistry;
    private readonly TimeProvider _timeProvider;

    private CollectionStatus _lastCollectionStatus = new(
        LastCycleStartedAt: null,
        LastCycleCompletedAt: null,
        LastCycleResult: null,
        LastErrorCode: null);

    private int _collectionIntervalSeconds = 15;
#pragma warning disable CS0414 // Campo atribuído mas nunca usado - usado para comando collect_now
    private bool _immediateCollectionRequested;
#pragma warning restore CS0414

    public AgentWorker(
        IServiceProvider serviceProvider,
        ILogger<AgentWorker> logger,
        CollectorRegistry collectorRegistry)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _collectorRegistry = collectorRegistry;
        _timeProvider = TimeProvider.System;
    }

    public void RequestImmediateCollection()
    {
        _immediateCollectionRequested = true;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Agent worker starting");

        await Task.Delay(5000, stoppingToken); // Wait for services to initialize

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _serviceProvider.CreateScope();
                var outbox = scope.ServiceProvider.GetRequiredService<SqliteOutbox>();
                var configService = scope.ServiceProvider.GetRequiredService<IConfigurationService>();
                var heartbeatService = scope.ServiceProvider.GetRequiredService<HeartbeatService>();

                // Update collection interval from config
                var config = configService.CurrentConfiguration;
                if (config?.Agent != null)
                {
                    _collectionIntervalSeconds = config.Agent.CollectionIntervalSeconds;
                }

                // Run collection cycle
                await RunCollectionCycleAsync(scope.ServiceProvider, stoppingToken);

                // Wait for next collection or heartbeat
                var waitTime = TimeSpan.FromSeconds(_collectionIntervalSeconds);
                var heartbeatInterval = TimeSpan.FromSeconds(heartbeatService.HeartbeatIntervalSeconds);

                // Send heartbeat if needed
                if (heartbeatInterval < waitTime)
                {
                    await Task.Delay(heartbeatInterval, stoppingToken);
                    await heartbeatService.SendHeartbeatAsync(stoppingToken);
                    waitTime -= heartbeatInterval;
                }

                if (waitTime > TimeSpan.Zero)
                {
                    await Task.Delay(waitTime, stoppingToken);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in agent worker loop");
                _lastCollectionStatus = _lastCollectionStatus with
                {
                    LastCycleResult = "failed",
                    LastErrorCode = "WORKER_LOOP_ERROR"
                };

                await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            }
        }

        _logger.LogInformation("Agent worker stopping");
    }

    private async Task RunCollectionCycleAsync(IServiceProvider services, CancellationToken ct)
    {
        var startedAt = DateTimeOffset.UtcNow;
        _lastCollectionStatus = _lastCollectionStatus with
        {
            LastCycleStartedAt = startedAt
        };

        try
        {
            var outbox = services.GetRequiredService<SqliteOutbox>();
            var configService = services.GetRequiredService<IConfigurationService>();

            var context = new CollectionContext
            {
                SourceId = Guid.Empty, // Will be set after enrollment
                SourceVersion = "1.0.0",
                Hostname = Environment.MachineName,
                CollectedAt = startedAt,
                LocalAssetId = GetLocalAssetId(),
                MachineFingerprint = GetMachineFingerprint(),
                CancellationToken = ct
            };

            // Get enabled collectors
            var enabledCollectors = GetEnabledCollectors(configService.CurrentConfiguration);
            var allRecords = new List<BatchRecord>();

            foreach (var collector in enabledCollectors)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    var result = await collector.CollectAsync(context, ct);
                    allRecords.AddRange(result.Records);

                    if (!result.Success)
                    {
                        _logger.LogWarning("Collector {Name} failed: {Error}", collector.Name, result.ErrorMessage);
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Collector {Name} threw exception", collector.Name);
                }
            }

            // Create batch if we have records
            if (allRecords.Count > 0)
            {
                var completedAt = DateTimeOffset.UtcNow;
                var batch = await outbox.CreateBatchAsync(
                    allRecords,
                    startedAt,
                    completedAt,
                    ct);

                _logger.LogDebug("Created batch {BatchId} with {Count} records",
                    batch.BatchId, allRecords.Count);

                // Try to send pending batches
                await SendPendingBatchesAsync(services, ct);
            }

            _lastCollectionStatus = _lastCollectionStatus with
            {
                LastCycleCompletedAt = DateTimeOffset.UtcNow,
                LastCycleResult = "success",
                LastErrorCode = null
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Collection cycle failed");

            _lastCollectionStatus = _lastCollectionStatus with
            {
                LastCycleCompletedAt = DateTimeOffset.UtcNow,
                LastCycleResult = "failed",
                LastErrorCode = "COLLECTION_CYCLE_ERROR"
            };
        }
    }

    private async Task SendPendingBatchesAsync(IServiceProvider services, CancellationToken ct)
    {
        try
        {
            var outbox = services.GetRequiredService<SqliteOutbox>();
            var enrollment = services.GetRequiredService<IEnrollmentService>();

            if (!enrollment.IsEnrolled || enrollment.Endpoints == null)
                return;

            var pending = await outbox.GetPendingBatchesAsync(ct);

            foreach (var (batch, payload) in pending)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    var client = CreateHttpClient(enrollment.AccessToken);
                    var response = await client.PostAsJsonAsync(
                        enrollment.Endpoints.Batches,
                        JsonContent.Create(batch),
                        ct);

                    if (response.IsSuccessStatusCode)
                    {
                        var ack = await response.Content.ReadFromJsonAsync<BatchSubmissionResponse>(ct);
                        if (ack != null)
                        {
                            await outbox.MarkBatchSentAsync(batch.BatchId,
                                await response.Content.ReadAsStringAsync(ct), ct);
                            await outbox.UpdateAckedSequenceAsync(ack.HighestContiguousSequence, ct);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to send batch {BatchId}", batch.BatchId);
                    break; // Stop trying if we hit an error
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending pending batches");
        }
    }

    private IReadOnlyList<IObservationCollector> GetEnabledCollectors(SourceConfiguration? config)
    {
        if (config?.Agent?.EnabledCollectors != null)
        {
            return _collectorRegistry.GetEnabled(config.Agent.EnabledCollectors);
        }

        // Default: all collectors
        return _collectorRegistry.GetAll();
    }

    private static string GetLocalAssetId()
    {
        var hostname = Environment.MachineName.ToLowerInvariant();
        var domain = Environment.GetEnvironmentVariable("USERDOMAIN")?.ToLowerInvariant();

        return string.IsNullOrEmpty(domain) || domain == hostname
            ? hostname
            : $"{hostname}.{domain}";
    }

    private static string GetMachineFingerprint()
    {
        try
        {
            var machineId = Microsoft.Win32.Registry.LocalMachine
                .OpenSubKey(@"SOFTWARE\Microsoft\Cryptography")
                ?.GetValue("MachineGuid")?.ToString();

            if (!string.IsNullOrEmpty(machineId))
            {
                using var sha256 = System.Security.Cryptography.SHA256.Create();
                var hash = sha256.ComputeHash(System.Text.Encoding.UTF8.GetBytes(machineId));
                return Convert.ToHexString(hash).ToLowerInvariant();
            }
        }
        catch { }

        return Environment.MachineName;
    }

    private static HttpClient CreateHttpClient(string? token)
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        if (!string.IsNullOrEmpty(token))
        {
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }
        return client;
    }
}
