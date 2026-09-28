using System.Net;
using System.Text;
using System.Text.Json;
using Inner.Agent.Windows.Contracts;
using Inner.Agent.Windows.Transport;
using Xunit;

namespace Inner.Agent.Windows.Tests;

public sealed class AgentApiClientTests
{
    [Fact]
    public async Task SendsMetricsWithAgentBearerAndReturnsAcknowledgement()
    {
        var handler = new RecordingHandler(async request =>
        {
            Assert.Equal(HttpMethod.Post, request.Method);
            Assert.Equal("/api/agent/v1/metrics", request.RequestUri?.AbsolutePath);
            Assert.Equal("Bearer access-1", request.Headers.Authorization?.ToString());

            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            Assert.Equal(3, body.RootElement.GetProperty("sequence").GetInt64());
            return JsonResponse("""{"status":"accepted","accepted_sequence_no":3}""");
        });
        using var httpClient = new HttpClient(handler);
        var client = new AgentApiClient(httpClient, "https://inner.example");

        var result = await client.SendMetricsAsync("access-1", new MetricBatch(
            3,
            DateTimeOffset.UtcNow,
            new HostMetrics("HV-01", 10, 20, 100, 20, 30, 10),
            Array.Empty<VirtualMachineMetrics>()));

        Assert.Equal("accepted", result.Status);
        Assert.Equal(3, result.AcceptedSequenceNo);
    }

    [Fact]
    public async Task EnrollsAndMapsCredentials()
    {
        var handler = new RecordingHandler(async request =>
        {
            Assert.Equal("/api/agent/v1/enroll", request.RequestUri?.AbsolutePath);
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync());
            Assert.Equal("bootstrap-token", body.RootElement.GetProperty("activation_token").GetString());
            return JsonResponse("""{"agent_id":"agent-1","company_id":"company-1","access_token":"access-1","refresh_token":"refresh-1","expires_in":900}""");
        });
        using var httpClient = new HttpClient(handler);
        var client = new AgentApiClient(httpClient, "https://inner.example/");

        var result = await client.EnrollAsync(new EnrollmentRequest(
            "bootstrap-token", "machine-1", "HV-01", "1.0.0", "Windows Server", "2022", "Hyper-V"));

        Assert.Equal("agent-1", result.AgentId);
        Assert.Equal("refresh-1", result.RefreshToken);
        Assert.Equal(900, result.ExpiresIn);
    }

    private static HttpResponseMessage JsonResponse(string json) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(json, Encoding.UTF8, "application/json")
    };

    private sealed class RecordingHandler(Func<HttpRequestMessage, Task<HttpResponseMessage>> handler) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            handler(request);
    }
}
