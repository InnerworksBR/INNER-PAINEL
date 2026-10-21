using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text;
using Inner.Network.Agent.Security;

namespace Inner.Network.Agent.Transport;

public sealed record PairingRequest(
    [property: JsonPropertyName("machine_id")] string MachineId,
    [property: JsonPropertyName("hostname")] string Hostname,
    [property: JsonPropertyName("agent_version")] string AgentVersion,
    [property: JsonPropertyName("os_version")] string OsVersion,
    [property: JsonPropertyName("detected_networks")] IReadOnlyList<string> DetectedNetworks);
public sealed record PairingResponse(
    [property: JsonPropertyName("pairing_id")] string PairingId,
    [property: JsonPropertyName("user_code")] string UserCode,
    [property: JsonPropertyName("device_secret")] string DeviceSecret,
    [property: JsonPropertyName("expires_at")] DateTimeOffset ExpiresAt,
    [property: JsonPropertyName("poll_interval_seconds")] int PollIntervalSeconds,
    [property: JsonPropertyName("verification_url")] string VerificationUrl);
public sealed record PairingStatus(
    [property: JsonPropertyName("state")] string State,
    [property: JsonPropertyName("company_name")] string? CompanyName = null);
public sealed record NetworkCredentials(
    [property: JsonPropertyName("agent_id")] string AgentId,
    [property: JsonPropertyName("company_id")] string CompanyId,
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string? RefreshToken,
    [property: JsonPropertyName("expires_in")] int ExpiresIn);
public sealed record NetworkAgentConfiguration(
    [property: JsonPropertyName("version")] int Version,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("collection_interval_seconds")] int CollectionIntervalSeconds,
    [property: JsonPropertyName("discovery_interval_seconds")] int DiscoveryIntervalSeconds,
    [property: JsonPropertyName("networks")] List<NetworkDefinition> Networks,
    [property: JsonPropertyName("credentials")] List<SnmpCredential> Credentials);
public sealed record NetworkDefinition(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("cidr")] string Cidr,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("snmp_port")] int SnmpPort,
    [property: JsonPropertyName("excluded_ips")] List<string> ExcludedIps,
    [property: JsonPropertyName("credential_ids")] List<string> CredentialIds,
    [property: JsonPropertyName("network_scope_id")] string? NetworkScopeId = null);
public sealed record SnmpCredential(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("version")] string Version,
    [property: JsonPropertyName("community")] string? Community = null,
    [property: JsonPropertyName("username")] string? Username = null,
    [property: JsonPropertyName("security_level")] string? SecurityLevel = null,
    [property: JsonPropertyName("auth_protocol")] string? AuthProtocol = null,
    [property: JsonPropertyName("auth_password")] string? AuthPassword = null,
    [property: JsonPropertyName("privacy_protocol")] string? PrivacyProtocol = null,
    [property: JsonPropertyName("privacy_password")] string? PrivacyPassword = null,
    [property: JsonPropertyName("context_name")] string? ContextName = null);

public sealed class NetworkApiClient(HttpClient httpClient, string apiBaseUrl)
{
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };
    private readonly Uri _apiRoot = NormalizeApiRoot(apiBaseUrl);

    public Task<PairingResponse> CreatePairingAsync(PairingRequest request, CancellationToken ct = default) =>
        SendAsync<PairingRequest, PairingResponse>(HttpMethod.Post, "/pairings", request, null, ct);

    public Task<PairingStatus> GetPairingStatusAsync(string pairingId, string deviceSecret, CancellationToken ct = default) =>
        SendAsync<object, PairingStatus>(HttpMethod.Post, "/pairings/status", new { pairing_id = pairingId, device_secret = deviceSecret }, null, ct);

    public Task<NetworkCredentials> CompletePairingAsync(string pairingId, string deviceSecret, string refreshTokenHash, CancellationToken ct = default) =>
        SendAsync<object, NetworkCredentials>(HttpMethod.Post, "/pairings/complete", new { pairing_id = pairingId, device_secret = deviceSecret, refresh_token_hash = refreshTokenHash }, null, ct);

    public Task<NetworkCredentials> RefreshAsync(string currentRefreshToken, string replacementRefreshToken, CancellationToken ct = default) =>
        SendAsync<object, NetworkCredentials>(HttpMethod.Post, "/refresh", new { refresh_token = currentRefreshToken, replacement_refresh_token = replacementRefreshToken }, null, ct);

    public Task<NetworkAgentConfiguration> GetConfigurationAsync(string accessToken, CancellationToken ct = default) =>
        SendAsync<object, NetworkAgentConfiguration>(HttpMethod.Get, "/network/config", null, accessToken, ct);

    public async Task<JsonElement> SendMetricsAsync(string agentId, string accessToken, long sequence, JsonElement batch, CancellationToken ct = default)
    {
        var acknowledgement = await SendAsync<JsonElement, JsonElement>(HttpMethod.Post, "/network/metrics", batch, accessToken, ct, $"{agentId}-{sequence}");
        if (acknowledgement.ValueKind != JsonValueKind.Object ||
            !acknowledgement.TryGetProperty("status", out var status) || status.ValueKind != JsonValueKind.String ||
            status.GetString() is not ("accepted" or "duplicate") ||
            !acknowledgement.TryGetProperty("sequence", out var acceptedSequence) || acceptedSequence.ValueKind != JsonValueKind.Number ||
            !acceptedSequence.TryGetInt64(out var actualSequence) || actualSequence != sequence)
            throw new NetworkApiException(HttpStatusCode.BadGateway, "Metrics acknowledgement did not match the submitted batch.");
        return acknowledgement;
    }

    public Task SendHeartbeatAsync(string accessToken, object heartbeat, CancellationToken ct = default) =>
        SendAsync<object, JsonElement>(HttpMethod.Post, "/heartbeat", heartbeat, accessToken, ct);

    private async Task<TResponse> SendAsync<TRequest, TResponse>(HttpMethod method, string path, TRequest? body, string? token, CancellationToken ct, string? idempotencyKey = null)
    {
        using var request = new HttpRequestMessage(method, new Uri(_apiRoot, "agent/v1" + path));
        if (body is not null) request.Content = JsonContent.Create(body, options: JsonOptions);
        if (token is not null) request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        if (idempotencyKey is not null) request.Headers.TryAddWithoutValidation("Idempotency-Key", idempotencyKey);
        using var response = await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(ct);
            throw new NetworkApiException(response.StatusCode, error, response.Headers.RetryAfter?.Delta);
        }
        if (typeof(TResponse) == typeof(JsonElement) &&
            (response.StatusCode == HttpStatusCode.NoContent || response.Content.Headers.ContentLength == 0))
            return (TResponse)(object)JsonDocument.Parse("{}").RootElement.Clone();
        var result = await response.Content.ReadFromJsonAsync<TResponse>(JsonOptions, ct);
        return result is null ? throw new NetworkApiException(response.StatusCode, "API returned an empty response.") : result;
    }

    private static Uri NormalizeApiRoot(string baseUrl)
    {
        if (!Uri.TryCreate(baseUrl, UriKind.Absolute, out var uri)) throw new ArgumentException("API base URL must be absolute.", nameof(baseUrl));
        var loopbackHttp = uri.Scheme == Uri.UriSchemeHttp && IPAddress.TryParse(uri.Host, out var ip) && IPAddress.IsLoopback(ip);
        if (uri.Scheme != Uri.UriSchemeHttps && !loopbackHttp)
            throw new ArgumentException("API base URL must use HTTPS.", nameof(baseUrl));
        var path = uri.AbsolutePath.TrimEnd('/');
        if (path.EndsWith("/api", StringComparison.OrdinalIgnoreCase)) path = path[..^4];
        return new UriBuilder(uri) { Path = path.TrimEnd('/') + "/api/" }.Uri;
    }
}

public sealed class NetworkApiException(HttpStatusCode statusCode, string message, TimeSpan? retryAfter = null) : Exception(message)
{
    public HttpStatusCode StatusCode { get; } = statusCode;
    public TimeSpan? RetryAfter { get; } = retryAfter;
    public bool ConfirmsAgentRevocation => StatusCode == HttpStatusCode.Unauthorized &&
        Message.Contains("Agente revogado ou não encontrado", StringComparison.OrdinalIgnoreCase);
}

public sealed class PairingCoordinator(NetworkApiClient api, INetworkSecretStore secrets)
{
    private const string RefreshKey = "refresh_token";
    private const string PendingTokenKey = "pairing_initial_refresh_token";
    private const string PendingSessionKey = "pairing_session";

    public async Task<NetworkCredentials> CompleteAsync(string pairingId, string deviceSecret, CancellationToken ct = default)
    {
        var pending = secrets.Read(PendingTokenKey);
        var session = secrets.Read(PendingSessionKey);
        if (pending is null || !string.Equals(session, pairingId, StringComparison.Ordinal))
        {
            pending = CreateRefreshToken();
            secrets.Save(PendingTokenKey, pending);
            secrets.Save(PendingSessionKey, pairingId);
        }
        secrets.Save(RefreshKey, pending);
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(pending))).ToLowerInvariant();
        var credentials = await api.CompletePairingAsync(pairingId, deviceSecret, hash, ct);
        secrets.Save("agent_id", credentials.AgentId);
        secrets.Save("company_id", credentials.CompanyId);
        secrets.Save("access_token", credentials.AccessToken);
        secrets.Delete(PendingTokenKey);
        secrets.Delete(PendingSessionKey);
        return credentials with { RefreshToken = pending };
    }

    private static string CreateRefreshToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}

public sealed class NetworkTokenManager(NetworkApiClient api, INetworkSecretStore secrets)
{
    public async Task<NetworkCredentials> RefreshAsync(CancellationToken ct = default)
    {
        var old = secrets.Read("refresh_pending_old") ?? secrets.Read("refresh_token") ?? throw new InvalidOperationException("No refresh token is enrolled.");
        var replacement = secrets.Read("refresh_pending_new");
        if (replacement is null)
        {
            replacement = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
            secrets.Save("refresh_pending_old", old);
            secrets.Save("refresh_pending_new", replacement);
            secrets.Save("refresh_token", replacement);
        }
        var credentials = await api.RefreshAsync(old, replacement, ct);
        secrets.Delete("refresh_pending_old");
        secrets.Delete("refresh_pending_new");
        secrets.Save("access_token", credentials.AccessToken);
        return credentials with { RefreshToken = replacement };
    }
}

public sealed class NetworkTokenRefreshCoordinator(NetworkApiClient api, INetworkSecretStore secrets)
{
    private readonly SemaphoreSlim _gate = new(1, 1);

    public async Task<NetworkCredentials?> RefreshAsync(string? rejectedAccessToken = null, CancellationToken ct = default)
    {
        await _gate.WaitAsync(ct);
        try
        {
            if (rejectedAccessToken is not null && !string.Equals(secrets.Read("access_token"), rejectedAccessToken, StringComparison.Ordinal))
                return null;
            return await new NetworkTokenManager(api, secrets).RefreshAsync(ct);
        }
        finally { _gate.Release(); }
    }
}

public sealed class NetworkAgentAuthorizationLifecycle(INetworkSecretStore secrets)
{
    private long _authorizationEpoch;
    private static readonly string[] EnrollmentSecrets =
    [
        "agent_id", "company_id", "access_token", "refresh_token",
        "refresh_pending_old", "refresh_pending_new"
    ];

    public bool AuthorizationLost => string.Equals(secrets.Read("agent_authorization_lost"), "true", StringComparison.Ordinal);
    public bool AgentRevoked => string.Equals(secrets.Read("agent_revoked"), "true", StringComparison.Ordinal);
    public bool CanUseCachedQueries => !AuthorizationLost && !AgentRevoked;
    public long AuthorizationEpoch => Interlocked.Read(ref _authorizationEpoch);
    public bool CanUseCachedQueriesForEpoch(long epoch) => epoch == AuthorizationEpoch && CanUseCachedQueries;

    public async Task<NetworkCredentials?> RefreshAfterAccessRejectedAsync(NetworkTokenRefreshCoordinator refresh,
        string? rejectedAccessToken, CancellationToken ct = default)
    {
        var enrolled = !string.IsNullOrWhiteSpace(secrets.Read("agent_id"));
        try { return await refresh.RefreshAsync(rejectedAccessToken, ct); }
        catch (NetworkApiException ex) when (enrolled && ex.StatusCode == HttpStatusCode.Unauthorized)
        {
            MarkAuthorizationLost();
            return null;
        }
    }

    public void MarkAuthorizationLost()
    {
        Interlocked.Increment(ref _authorizationEpoch);
        secrets.Save("agent_authorization_lost", "true");
        secrets.Delete("configuration_cache");
        foreach (var key in EnrollmentSecrets) secrets.Delete(key);
    }

    public void MarkAgentRevoked()
    {
        secrets.Save("agent_revoked", "true");
        MarkAuthorizationLost();
    }

    public void ClearAfterSuccessfulRelink()
    {
        Interlocked.Increment(ref _authorizationEpoch);
        secrets.Delete("configuration_cache");
        secrets.Delete("agent_authorization_lost");
        secrets.Delete("agent_revoked");
    }
}
