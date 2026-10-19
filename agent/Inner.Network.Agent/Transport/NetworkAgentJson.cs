using System.Text.Json;
using System.Text.Json.Serialization;
using Inner.Network.Agent.Workers;
using Inner.Network.Agent.Persistence;
using Microsoft.Extensions.Logging;

namespace Inner.Network.Agent.Transport;

public static class NetworkMetricsJson
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public static string Serialize(NetworkMetricBatch batch) => JsonSerializer.Serialize(batch, Options);
}

public sealed record NetworkHeartbeatPayload(
    [property: JsonPropertyName("source_time")] DateTimeOffset SourceTime,
    [property: JsonPropertyName("uptime_seconds")] long UptimeSeconds,
    [property: JsonPropertyName("agent_version")] string AgentVersion,
    [property: JsonPropertyName("last_created_sequence")] long LastCreatedSequence,
    [property: JsonPropertyName("last_acked_sequence")] long LastAcknowledgedSequence,
    [property: JsonPropertyName("pending_count")] int PendingCount,
    [property: JsonPropertyName("pending_bytes")] long PendingBytes,
    [property: JsonPropertyName("last_collection_result")] string? LastCollectionResult,
    [property: JsonPropertyName("last_error_code")] string? LastErrorCode,
    [property: JsonPropertyName("discovery_state")] string DiscoveryState,
    [property: JsonPropertyName("discovered_devices")] int DiscoveredDevices,
    [property: JsonPropertyName("last_discovery_at")] DateTimeOffset? LastDiscoveryAt);

public sealed class NetworkHeartbeatLoop(Func<CancellationToken, Task> publish, ILogger logger)
{
    public async Task RunAsync(CancellationToken ct, TimeSpan? interval = null)
    {
        while (!ct.IsCancellationRequested)
        {
            try { await publish(ct); }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Network agent heartbeat deferred: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(interval ?? TimeSpan.FromSeconds(30), ct);
        }
    }
}

public sealed class NetworkOutboxSender(NetworkAgentStore store, NetworkApiClient api)
{
    public async Task<bool> SendOneAsync(string agentId, string accessToken, PendingNetworkBatch batch, CancellationToken ct = default)
    {
        using var document = JsonDocument.Parse(batch.Payload);
        try { await api.SendMetricsAsync(agentId, accessToken, batch.Sequence, document.RootElement, ct); }
        catch (NetworkApiException ex) when (ex.StatusCode is System.Net.HttpStatusCode.BadRequest or System.Net.HttpStatusCode.RequestEntityTooLarge)
        {
            await store.RejectBatchAsync(batch.Sequence, (int)ex.StatusCode, "backend_rejected_payload", ct);
            return false;
        }
        await store.AcknowledgeAsync(batch.Sequence, ct);
        return true;
    }
}
