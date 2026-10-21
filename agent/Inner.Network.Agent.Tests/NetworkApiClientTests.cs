using System.Net;
using System.Text;
using System.Text.Json;
using Inner.Network.Agent.Security;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Transport;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkApiClientTests
{
    [Fact]
    public async Task Heartbeat_accepts_204_without_content_length_instead_of_parsing_empty_json()
    {
        using var http = new HttpClient(new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NoContent)
        {
            Content = new EmptyUnspecifiedLengthContent()
        }));
        var client = new NetworkApiClient(http, "https://api.example.test");

        await client.SendHeartbeatAsync("access", new { source_time = DateTimeOffset.UtcNow });
    }

    [Fact]
    public async Task Metrics_204_without_body_does_not_acknowledge_a_batch()
    {
        using var http = new HttpClient(new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.NoContent)
        {
            Content = new EmptyUnspecifiedLengthContent()
        }));
        var client = new NetworkApiClient(http, "https://api.example.test");
        using var payload = JsonDocument.Parse("{\"sequence\":1,\"devices\":[]}");

        var error = await Assert.ThrowsAsync<NetworkApiException>(() =>
            client.SendMetricsAsync("agent", "access", 1, payload.RootElement));

        Assert.Equal(HttpStatusCode.BadGateway, error.StatusCode);
    }

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

    [Fact]
    public async Task Pairing_retry_after_server_committed_but_reply_was_lost_reuses_same_hash_across_restart()
    {
        var store = new MemorySecretStore();
        var calls = 0;
        string? committedHash = null;
        using var http = new HttpClient(new StubHandler(request =>
        {
            calls++;
            using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            var hash = body.RootElement.GetProperty("refresh_token_hash").GetString();
            if (calls == 1)
            {
                committedHash = hash;
                throw new HttpRequestException("server committed, response lost");
            }
            Assert.Equal(committedHash, hash);
            return Json("{\"agent_id\":\"agent\",\"company_id\":\"company\",\"access_token\":\"access\",\"expires_in\":600}");
        }));

        await Assert.ThrowsAsync<HttpRequestException>(() => new PairingCoordinator(new NetworkApiClient(http, "https://api.example.test"), store).CompleteAsync("pair-1", "device-secret"));
        var persistedToken = store.Read("refresh_token");
        var resumed = await new PairingCoordinator(new NetworkApiClient(http, "https://api.example.test"), store).CompleteAsync("pair-1", "device-secret");

        Assert.Equal(persistedToken, resumed.RefreshToken);
        Assert.Equal("agent", store.Read("agent_id"));
        Assert.Equal("company", store.Read("company_id"));
        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task Concurrent_401_refreshes_share_one_persisted_old_new_rotation_pair()
    {
        var secrets = new MemorySecretStore();
        secrets.Save("refresh_token", "refresh-old");
        secrets.Save("access_token", "access-old");
        var requestCount = 0;
        var entered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        string? oldToken = null;
        string? replacement = null;
        using var http = new HttpClient(new AsyncStubHandler(async (request, ct) =>
        {
            Interlocked.Increment(ref requestCount);
            using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
            oldToken = body.RootElement.GetProperty("refresh_token").GetString();
            replacement = body.RootElement.GetProperty("replacement_refresh_token").GetString();
            entered.TrySetResult();
            await release.Task.WaitAsync(ct);
            return Json("{\"agent_id\":\"agent\",\"company_id\":\"company\",\"access_token\":\"access-new\",\"refresh_token\":\"replacement\",\"expires_in\":600}");
        }));
        var refresher = new NetworkTokenRefreshCoordinator(new NetworkApiClient(http, "https://api.example.test"), secrets);

        var refreshes = Enumerable.Range(0, 8).Select(_ => refresher.RefreshAsync("access-old")).ToArray();
        await entered.Task.WaitAsync(TimeSpan.FromSeconds(2));
        release.SetResult();
        await Task.WhenAll(refreshes);

        Assert.Equal(1, requestCount);
        Assert.Equal("refresh-old", oldToken);
        Assert.Equal(secrets.Read("refresh_token"), replacement);
        Assert.Equal("access-new", secrets.Read("access_token"));
    }

    [Theory]
    [InlineData("{\"status\":\"accepted\",\"sequence\":99}")]
    [InlineData("{\"status\":\"queued\",\"sequence\":1}")]
    public async Task Invalid_metrics_acknowledgement_leaves_outbox_batch_pending(string ack)
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-ack-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            var sequence = await store.NextSequenceAsync();
            await store.EnqueueAsync(sequence, "{}" );
            using var http = new HttpClient(new StubHandler(_ => Json(ack)));
            var sender = new NetworkOutboxSender(store, new NetworkApiClient(http, "https://api.example.test"));
            var batch = Assert.Single(await store.ReadPendingAsync(10));

            await Assert.ThrowsAsync<NetworkApiException>(() => sender.SendOneAsync("agent", "access", batch));

            Assert.Single(await store.ReadPendingAsync(10));
        }
        finally
        {
            foreach (var file in new[] { path, path + "-shm", path + "-wal" }) if (File.Exists(file)) File.Delete(file);
        }
    }

    [Theory]
    [InlineData(HttpStatusCode.BadRequest)]
    [InlineData(HttpStatusCode.RequestEntityTooLarge)]
    public async Task Permanent_400_or_413_is_bounded_diagnostic_and_does_not_block_later_batches(HttpStatusCode rejection)
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-rejected-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            var rejectedSequence = await store.NextSequenceAsync();
            var acceptedSequence = await store.NextSequenceAsync();
            await store.EnqueueAsync(rejectedSequence, $"{{\"sequence\":{rejectedSequence}}}");
            await store.EnqueueAsync(acceptedSequence, $"{{\"sequence\":{acceptedSequence}}}");
            using var http = new HttpClient(new StubHandler(request =>
            {
                using var body = JsonDocument.Parse(request.Content!.ReadAsStringAsync().GetAwaiter().GetResult());
                var sequence = body.RootElement.GetProperty("sequence").GetInt64();
                return sequence == rejectedSequence
                    ? new HttpResponseMessage(rejection) { Content = new StringContent("invalid network payload") }
                    : Json($"{{\"status\":\"accepted\",\"sequence\":{sequence}}}");
            }));
            var sender = new NetworkOutboxSender(store, new NetworkApiClient(http, "https://api.example.test"));

            var pending = await store.ReadPendingAsync(10);
            Assert.False(await sender.SendOneAsync("agent", "access", pending[0]));
            Assert.Equal(1, await store.GetRejectedBatchCountAsync());
            var afterReject = await store.GetOutboxStatusAsync();
            Assert.Equal(0, afterReject.AcknowledgedSequence);
            Assert.Single(await store.ReadPendingAsync(10));

            Assert.True(await sender.SendOneAsync("agent", "access", Assert.Single(await store.ReadPendingAsync(10))));
            Assert.Empty(await store.ReadPendingAsync(10));
            Assert.Equal(acceptedSequence, (await store.GetOutboxStatusAsync()).AcknowledgedSequence);
        }
        finally
        {
            foreach (var file in new[] { path, path + "-shm", path + "-wal" }) if (File.Exists(file)) File.Delete(file);
        }
    }

    private static HttpResponseMessage Json(string body) => new(HttpStatusCode.OK)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class StubHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
    }

    private sealed class EmptyUnspecifiedLengthContent : HttpContent
    {
        protected override bool TryComputeLength(out long length) { length = 0; return false; }
        protected override Task SerializeToStreamAsync(Stream stream, TransportContext? context) => Task.CompletedTask;
    }

    private sealed class AsyncStubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => respond(request, cancellationToken);
    }

    private sealed class MemorySecretStore : INetworkSecretStore
    {
        private readonly Dictionary<string, string> _values = new();
        public void Save(string key, string value) => _values[key] = value;
        public string? Read(string key) => _values.GetValueOrDefault(key);
        public void Delete(string key) => _values.Remove(key);
    }
}
