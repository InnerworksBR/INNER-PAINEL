using System.Net;
using System.Runtime.InteropServices;
using System.Text.Json;
using Inner.Agent.Windows.Collectors;
using Inner.Agent.Windows.Contracts;
using Inner.Agent.Windows.Persistence;
using Inner.Agent.Windows.Security;
using Inner.Agent.Windows.Transport;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Inner.Agent.Windows;

public sealed class AgentWorker(
    IHostMetricsCollector hostCollector,
    HyperVCollector hyperVCollector,
    IAgentOutbox outbox,
    DpapiSecretStore secretStore,
    AgentApiClient apiClient,
    IOptions<AgentOptions> options,
    ILogger<AgentWorker> logger) : BackgroundService
{
    private const string CredentialsKey = "credentials";
    private const string AgentVersion = "1.0.0";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    private DateTimeOffset _lastHeartbeatAt = DateTimeOffset.MinValue;
    private string? _lastCollectionResult;
    private string? _lastErrorCode;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await outbox.InitializeAsync(stoppingToken);
        logger.LogInformation("Inner Hyper-V agent started on {Hostname}", Environment.MachineName);
        var interval = TimeSpan.FromSeconds(Math.Clamp(options.Value.CollectionIntervalSeconds, 15, 3600));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await EnsureEnrolledAsync(stoppingToken))
                {
                    await CollectAndQueueAsync(stoppingToken);
                    await SendPendingAsync(stoppingToken);

                    if (DateTimeOffset.UtcNow >= _lastHeartbeatAt.AddMinutes(1))
                    {
                        await SendHeartbeatAsync(stoppingToken);
                        _lastHeartbeatAt = DateTimeOffset.UtcNow;
                    }
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception error)
            {
                _lastCollectionResult = "failed";
                _lastErrorCode = "WORKER_LOOP_ERROR";
                logger.LogError(error, "Agent worker loop failed");
            }

            await Task.Delay(interval, stoppingToken);
        }
    }

    private async Task<bool> EnsureEnrolledAsync(CancellationToken cancellationToken)
    {
        var stored = ReadStoredCredentials();
        if (stored is not null)
        {
            if (stored.ObtainedAt.AddSeconds(Math.Max(60, stored.Credentials.ExpiresIn - 60)) > DateTimeOffset.UtcNow)
                return true;

            try
            {
                var refreshed = await apiClient.RefreshAsync(stored.Credentials.RefreshToken, cancellationToken);
                SaveCredentials(refreshed);
                return true;
            }
            catch (Exception error)
            {
                logger.LogWarning(error, "Agent credential refresh failed");
                return false;
            }
        }

        var activationToken = ReadActivationToken();
        if (string.IsNullOrWhiteSpace(activationToken))
        {
            logger.LogWarning("Agent is not enrolled. Bootstrap token was not found.");
            return false;
        }

        try
        {
            var credentials = await apiClient.EnrollAsync(new EnrollmentRequest(
                activationToken,
                MachineIdentity.GetCurrent(),
                Environment.MachineName,
                AgentVersion,
                RuntimeInformation.OSDescription,
                Environment.OSVersion.VersionString,
                "Hyper-V"), cancellationToken);
            SaveCredentials(credentials);
            TryDeleteBootstrap();
            logger.LogInformation("Agent enrollment completed for {AgentId}", credentials.AgentId);
            return true;
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Agent enrollment failed");
            return false;
        }
    }

    private async Task CollectAndQueueAsync(CancellationToken cancellationToken)
    {
        try
        {
            var hostTask = hostCollector.CollectAsync(cancellationToken);
            var virtualMachinesTask = hyperVCollector.CollectAsync(cancellationToken);
            await Task.WhenAll(hostTask, virtualMachinesTask);

            var batch = new MetricBatch(
                0,
                DateTimeOffset.UtcNow,
                await hostTask,
                await virtualMachinesTask);
            await outbox.EnqueueAsync(MetricBatchContract.Validate(batch), cancellationToken);
            _lastCollectionResult = "success";
            _lastErrorCode = null;
        }
        catch (Exception error) when (error is not OperationCanceledException)
        {
            _lastCollectionResult = "failed";
            _lastErrorCode = "COLLECTION_ERROR";
            logger.LogError(error, "Metric collection failed");
        }
    }

    private async Task SendPendingAsync(CancellationToken cancellationToken)
    {
        var stored = ReadStoredCredentials();
        if (stored is null) return;

        var pending = await outbox.GetPendingAsync(10, cancellationToken);
        foreach (var item in pending)
        {
            try
            {
                var batch = JsonSerializer.Deserialize<MetricBatch>(item.Payload, JsonOptions)
                    ?? throw new InvalidOperationException("Outbox payload is empty.");
                var acknowledgement = await apiClient.SendMetricsAsync(stored.Credentials.AccessToken, batch, cancellationToken);
                if (acknowledgement.Status is "accepted" or "duplicate")
                    await outbox.MarkAcceptedAsync(item.Sequence, cancellationToken);
            }
            catch (AgentApiException error) when (error.StatusCode == HttpStatusCode.Unauthorized)
            {
                stored = await RefreshStoredCredentialsAsync(stored, cancellationToken);
                if (stored is null) return;
                var batch = JsonSerializer.Deserialize<MetricBatch>(item.Payload, JsonOptions)
                    ?? throw new InvalidOperationException("Outbox payload is empty.");
                var acknowledgement = await apiClient.SendMetricsAsync(stored.Credentials.AccessToken, batch, cancellationToken);
                if (acknowledgement.Status is "accepted" or "duplicate")
                    await outbox.MarkAcceptedAsync(item.Sequence, cancellationToken);
            }
            catch (Exception error)
            {
                logger.LogWarning(error, "Could not send metric sequence {Sequence}; it remains in the outbox", item.Sequence);
                return;
            }
        }
    }

    private async Task SendHeartbeatAsync(CancellationToken cancellationToken)
    {
        var stored = ReadStoredCredentials();
        if (stored is null) return;
        var status = await outbox.GetStatusAsync(cancellationToken);
        await apiClient.SendHeartbeatAsync(stored.Credentials.AccessToken, new AgentHeartbeat(
            DateTimeOffset.UtcNow,
            Environment.TickCount64 / 1000,
            AgentVersion,
            status.LastCreatedSequence,
            status.LastAcceptedSequence,
            status.PendingCount,
            status.PendingBytes,
            _lastCollectionResult,
            _lastErrorCode), cancellationToken);
    }

    private async Task<StoredCredentials?> RefreshStoredCredentialsAsync(
        StoredCredentials current,
        CancellationToken cancellationToken)
    {
        try
        {
            var refreshed = await apiClient.RefreshAsync(current.Credentials.RefreshToken, cancellationToken);
            SaveCredentials(refreshed);
            return new StoredCredentials(refreshed, DateTimeOffset.UtcNow);
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Agent refresh after unauthorized response failed");
            return null;
        }
    }

    private StoredCredentials? ReadStoredCredentials()
    {
        var json = secretStore.Read(CredentialsKey);
        return string.IsNullOrWhiteSpace(json)
            ? null
            : JsonSerializer.Deserialize<StoredCredentials>(json, JsonOptions);
    }

    private void SaveCredentials(AgentCredentials credentials)
    {
        secretStore.Save(CredentialsKey, JsonSerializer.Serialize(
            new StoredCredentials(credentials, DateTimeOffset.UtcNow), JsonOptions));
    }

    private string? ReadActivationToken()
    {
        var path = options.Value.BootstrapFile;
        if (!Path.IsPathRooted(path)) path = Path.Combine(AppContext.BaseDirectory, path);
        if (!File.Exists(path)) return null;

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllText(path));
            return document.RootElement.TryGetProperty("activation_token", out var value)
                ? value.GetString()
                : null;
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Bootstrap file could not be read");
            return null;
        }
    }

    private void TryDeleteBootstrap()
    {
        var path = options.Value.BootstrapFile;
        if (!Path.IsPathRooted(path)) path = Path.Combine(AppContext.BaseDirectory, path);
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch (Exception error)
        {
            logger.LogWarning(error, "Bootstrap file could not be removed after enrollment");
        }
    }

    private sealed record StoredCredentials(AgentCredentials Credentials, DateTimeOffset ObtainedAt);
}
