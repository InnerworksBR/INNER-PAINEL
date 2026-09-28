using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Inner.Agent.Windows.Contracts;

namespace Inner.Agent.Windows.Transport;

public sealed record EnrollmentRequest(
    string ActivationToken,
    string MachineId,
    string Hostname,
    string AgentVersion,
    string? OsInfo,
    string? OsVersion,
    string Hypervisor);

public sealed record AgentCredentials(
    string AgentId,
    string CompanyId,
    string AccessToken,
    string RefreshToken,
    int ExpiresIn);

public sealed record MetricAcknowledgement(
    string Status,
    long AcceptedSequenceNo,
    DateTimeOffset? AcceptedAt);

public sealed record AgentHeartbeat(
    DateTimeOffset SourceTime,
    long UptimeSeconds,
    string AgentVersion,
    long LastCreatedSequence,
    long LastAckedSequence,
    int PendingCount,
    long PendingBytes,
    string? LastCollectionResult,
    string? LastErrorCode);

public sealed class AgentApiException : Exception
{
    public AgentApiException(HttpStatusCode statusCode, string message) : base(message)
    {
        StatusCode = statusCode;
    }

    public HttpStatusCode StatusCode { get; }
}

public sealed class AgentApiClient(HttpClient httpClient, string apiBaseUrl)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
    };

    public Task<AgentCredentials> EnrollAsync(EnrollmentRequest request, CancellationToken cancellationToken = default) =>
        SendAsync<EnrollmentRequest, AgentCredentials>(HttpMethod.Post, "/enroll", request, token: null, cancellationToken);

    public Task<AgentCredentials> RefreshAsync(string refreshToken, CancellationToken cancellationToken = default) =>
        SendAsync<object, AgentCredentials>(HttpMethod.Post, "/refresh", new { refresh_token = refreshToken }, token: null, cancellationToken);

    public Task<MetricAcknowledgement> SendMetricsAsync(
        string accessToken,
        MetricBatch batch,
        CancellationToken cancellationToken = default)
    {
        var validated = MetricBatchContract.Validate(batch);
        return SendAsync<MetricBatch, MetricAcknowledgement>(HttpMethod.Post, "/metrics", validated, accessToken, cancellationToken);
    }

    public async Task SendHeartbeatAsync(
        string accessToken,
        AgentHeartbeat heartbeat,
        CancellationToken cancellationToken = default)
    {
        using var response = await SendResponseAsync(HttpMethod.Post, "/heartbeat", heartbeat, accessToken, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
    }

    private async Task<TResponse> SendAsync<TRequest, TResponse>(
        HttpMethod method,
        string path,
        TRequest body,
        string? token,
        CancellationToken cancellationToken)
    {
        using var response = await SendResponseAsync(method, path, body, token, cancellationToken);
        await EnsureSuccessAsync(response, cancellationToken);
        var result = await response.Content.ReadFromJsonAsync<TResponse>(JsonOptions, cancellationToken);
        return result ?? throw new AgentApiException(response.StatusCode, "API returned an empty response.");
    }

    private async Task<HttpResponseMessage> SendResponseAsync<TRequest>(
        HttpMethod method,
        string path,
        TRequest body,
        string? token,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(method, BuildUri(path))
        {
            Content = JsonContent.Create(body, options: JsonOptions)
        };
        if (!string.IsNullOrWhiteSpace(token))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return await httpClient.SendAsync(request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);
    }

    private Uri BuildUri(string path) => new(new Uri(apiBaseUrl.TrimEnd('/') + "/"), $"api/agent/v1{path}");

    private static async Task EnsureSuccessAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        if (response.IsSuccessStatusCode) return;
        var detail = await response.Content.ReadAsStringAsync(cancellationToken);
        throw new AgentApiException(response.StatusCode, $"Agent API returned {(int)response.StatusCode}: {detail}");
    }
}
