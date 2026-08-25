using System.Net.Http.Json;
using System.Text.Json;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Agent.Windows.Services;

/// <summary>
///     Serviço de heartbeat.
/// </summary>
public sealed class HeartbeatService : IHeartbeatService
{
    private readonly IEnrollmentService _enrollmentService;
    private readonly IOutbox _outbox;
    private readonly ILogger<HeartbeatService> _logger;

    private int _heartbeatIntervalSeconds = 60;
    private CollectionStatus _lastCollectionStatus = new(
        LastCycleStartedAt: null,
        LastCycleCompletedAt: null,
        LastCycleResult: null,
        LastErrorCode: null);
    private LocalHealthStatus _localHealth = new(
        Status: "healthy",
        Warnings: Array.Empty<string>());

    private long _startTime;

    public HeartbeatService(
        IEnrollmentService enrollmentService,
        IOutbox outbox,
        ILogger<HeartbeatService> logger)
    {
        _enrollmentService = enrollmentService;
        _outbox = outbox;
        _logger = logger;
        _startTime = Environment.TickCount64;
    }

    public int HeartbeatIntervalSeconds => _heartbeatIntervalSeconds;

    public async Task<HeartbeatResponse?> SendHeartbeatAsync(CancellationToken ct)
    {
        if (!_enrollmentService.IsEnrolled || _enrollmentService.SourceId == null)
        {
            _logger.LogDebug("Not enrolled, skipping heartbeat");
            return null;
        }

        var endpoints = _enrollmentService.Endpoints;
        if (endpoints == null)
        {
            _logger.LogWarning("Missing endpoints configuration");
            return null;
        }

        var uptimeMs = Environment.TickCount64 - _startTime;
        var uptimeSeconds = uptimeMs / 1000;

        var outboxStatus = await _outbox.GetStatusAsync(ct);
        var lastSeq = await _outbox.GetLastAckedSequenceAsync(ct);

        var request = new HeartbeatRequest(
            SourceTime: DateTimeOffset.UtcNow,
            UptimeSeconds: uptimeSeconds,
            SourceVersion: "1.0.0",
            ConfigVersion: 0,
            LastCreatedSequence: 0,
            LastAckedSequence: lastSeq,
            Outbox: outboxStatus,
            Collection: _lastCollectionStatus,
            Capabilities: new SourceCapabilities(
                HostMetrics: true,
                HyperV: false,
                SnmpV2c: false,
                SnmpV3: false),
            LocalHealth: _localHealth);

        try
        {
            var client = CreateHttpClient();
            var response = await client.PostAsJsonAsync(
                endpoints.Heartbeat,
                request,
                ct);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Heartbeat failed with status {Status}", response.StatusCode);
                return null;
            }

            var result = await response.Content.ReadFromJsonAsync<HeartbeatResponse>(ct);

            if (result != null)
            {
                _heartbeatIntervalSeconds = result.NextHeartbeatSeconds;
                _logger.LogDebug("Heartbeat successful. Next interval: {Interval}s", result.NextHeartbeatSeconds);
            }

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Heartbeat request failed");
            return null;
        }
    }

    public void UpdateCollectionStatus(CollectionStatus status)
    {
        _lastCollectionStatus = status;
    }

    public void UpdateLocalHealth(string status, IReadOnlyList<string> warnings)
    {
        _localHealth = new LocalHealthStatus(status, warnings);
    }

    private HttpClient CreateHttpClient()
    {
        var handler = new HttpClientHandler();
        var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        var token = _enrollmentService.AccessToken;
        if (!string.IsNullOrEmpty(token))
        {
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        return client;
    }
}
