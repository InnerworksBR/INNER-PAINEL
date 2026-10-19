using System.Net;
using System.Text;
using System.Text.Json;
using Inner.Network.Agent.Security;
using Inner.Network.Agent.Transport;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkApiClientTests
{
    [Fact]
    public async Task Pairing_uses_snake_case_api_route_even_when_base_url_includes_api()
    {
        string? capturedUri = null;
        string? capturedBody = null;
        using var http = new HttpClient(new StubHandler(request =>
        {
            capturedUri = request.RequestUri!.ToString();
            capturedBody = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return Json("{\"pairing_id\":\"pair-1\",\"user_code\":\"ABCD-EFGH-JKLM\",\"device_secret\":\"secret\",\"expires_at\":\"2026-10-19T12:00:00Z\",\"poll_interval_seconds\":5,\"verification_url\":\"https://portal/\"}");
        }));
        var client = new NetworkApiClient(http, "https://api.example.test/api/");

        var result = await client.CreatePairingAsync(new PairingRequest("machine", "host", "1.0", "Windows", ["10.0.0.0/24"]));

        Assert.Equal("ABCD-EFGH-JKLM", result.UserCode);
        Assert.Equal("https://api.example.test/api/agent/v1/pairings", capturedUri);
        using var body = JsonDocument.Parse(capturedBody!);
        Assert.Equal("machine", body.RootElement.GetProperty("machine_id").GetString());
        Assert.False(body.RootElement.TryGetProperty("machineId", out _));
    }

    [Fact]
    public async Task Refresh_sends_old_and_persisted_replacement_for_lost_response_retry()
    {
        string? payload = null;
        using var http = new HttpClient(new StubHandler(request =>
        {
            payload = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return Json("{\"access_token\":\"access\",\"refresh_token\":\"replacement\",\"expires_in\":600}");
        }));
        var client = new NetworkApiClient(http, "https://api.example.test");

        await client.RefreshAsync("old", "replacement");

        using var body = JsonDocument.Parse(payload!);
        Assert.Equal("old", body.RootElement.GetProperty("refresh_token").GetString());
        Assert.Equal("replacement", body.RootElement.GetProperty("replacement_refresh_token").GetString());
    }

    [Fact]
    public async Task Completion_persists_refresh_before_post_and_reuses_it_after_lost_response()
    {
        var store = new MemorySecretStore();
        var calls = 0;
        using var http = new HttpClient(new StubHandler(_ =>
        {
            calls++;
            if (calls == 1) throw new HttpRequestException("response lost");
            return Json("{\"agent_id\":\"agent\",\"company_id\":\"company\",\"access_token\":\"access\",\"expires_in\":600}");
        }));
        var coordinator = new PairingCoordinator(new NetworkApiClient(http, "https://api.example.test"), store);

        await Assert.ThrowsAsync<HttpRequestException>(() => coordinator.CompleteAsync("pair", "device-secret"));
        var firstPersisted = store.Read("refresh_token");
        Assert.False(string.IsNullOrWhiteSpace(firstPersisted));

        await coordinator.CompleteAsync("pair", "device-secret");

        Assert.Equal(firstPersisted, store.Read("refresh_token"));
        Assert.Equal(2, calls);
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
    }

    private sealed class MemorySecretStore : INetworkSecretStore
    {
        private readonly Dictionary<string, string> _values = new();
        public void Save(string key, string value) => _values[key] = value;
        public string? Read(string key) => _values.GetValueOrDefault(key);
        public void Delete(string key) => _values.Remove(key);
    }
}
