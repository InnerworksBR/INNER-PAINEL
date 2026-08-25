using System.Net.Http.Json;
using System.Text.Json;
using Inner.Monitoring.Agent.Windows.Collectors;
using Inner.Monitoring.Agent.Windows.Outbox;
using Inner.Monitoring.Agent.Windows.Services;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Background service principal do Agent.
/// </summary>
public sealed class AgentWorker : BackgroundService
{
    private readonly ILogger<AgentWorker> _logger;
    private readonly CollectorRegistry _collectorRegistry;
    private readonly SqliteOutbox _outbox;
    private readonly IConfigurationService _configService;
    private readonly IHeartbeatService _heartbeatService;
    private readonly IEnrollmentService _enrollmentService;
    private readonly TimeProvider _timeProvider;
    private DateTimeOffset _nextHeartbeatAt = DateTimeOffset.MinValue;

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
        ILogger<AgentWorker> logger,
        CollectorRegistry collectorRegistry,
        SqliteOutbox outbox,
        IConfigurationService configService,
        IHeartbeatService heartbeatService,
        IEnrollmentService enrollmentService)
    {
        _logger = logger;
        _collectorRegistry = collectorRegistry;
        _outbox = outbox;
        _configService = configService;
        _heartbeatService = heartbeatService;
        _enrollmentService = enrollmentService;
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
                if (!await _enrollmentService.EnsureValidTokenAsync(stoppingToken))
                {
                    _logger.LogWarning("Agent has no valid access token");
                    await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
                    continue;
                }

                // Update collection interval from config
                var config = _configService.CurrentConfiguration;
                if (config?.Agent != null)
                {
                    _collectionIntervalSeconds = config.Agent.CollectionIntervalSeconds;
                }

                // Run collection cycle
                await RunCollectionCycleAsync(stoppingToken);

                if (_timeProvider.GetUtcNow() >= _nextHeartbeatAt)
                {
                    await _heartbeatService.SendHeartbeatAsync(stoppingToken);
                    _nextHeartbeatAt = _timeProvider.GetUtcNow().AddSeconds(
                        _heartbeatService.HeartbeatIntervalSeconds);
                }

                await Task.Delay(TimeSpan.FromSeconds(_collectionIntervalSeconds), stoppingToken);
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

    private async Task RunCollectionCycleAsync(CancellationToken ct)
    {
        var startedAt = DateTimeOffset.UtcNow;
        _lastCollectionStatus = _lastCollectionStatus with
        {
            LastCycleStartedAt = startedAt
        };

        try
        {
            var context = new CollectionContext
            {
                SourceId = _enrollmentService.SourceId ?? Guid.Empty,
                SourceVersion = "1.0.0",
                Hostname = Environment.MachineName,
                CollectedAt = startedAt,
                LocalAssetId = GetLocalAssetId(),
                MachineFingerprint = GetMachineFingerprint(),
                CancellationToken = ct
            };

            // Get enabled collectors
            var enabledCollectors = GetEnabledCollectors(_configService.CurrentConfiguration);
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
                var batch = await _outbox.CreateBatchAsync(
                    allRecords,
                    startedAt,
                    completedAt,
                    ct);

                _logger.LogDebug("Created batch {BatchId} with {Count} records",
                    batch.BatchId, allRecords.Count);

                // Try to send pending batches
                await SendPendingBatchesAsync(ct);
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

    private async Task SendPendingBatchesAsync(CancellationToken ct)
    {
        try
        {
            if (!_enrollmentService.IsEnrolled || _enrollmentService.Endpoints == null)
                return;

            var pending = await _outbox.GetPendingBatchesAsync(ct);

            foreach (var (batch, payload) in pending)
            {
                ct.ThrowIfCancellationRequested();

                try
                {
                    var client = CreateHttpClient(_enrollmentService.AccessToken);
                    var response = await client.PostAsJsonAsync(
                        _enrollmentService.Endpoints.Batches,
                        batch,
                        ApiJsonOptions,
                        ct);

                    if (response.IsSuccessStatusCode)
                    {
                        var ack = await response.Content.ReadFromJsonAsync<BatchSubmissionResponse>(ApiJsonOptions, ct);
                        if (ack != null)
                        {
                            await _outbox.MarkBatchSentAsync(batch.BatchId,
                                await response.Content.ReadAsStringAsync(ct), ct);
                            await _outbox.UpdateAckedSequenceAsync(ack.HighestContiguousSequence, ct);
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

    private static readonly JsonSerializerOptions ApiJsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };
}
