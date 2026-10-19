using System.Net;
using System.Text;
using System.Text.Json;
using Inner.Network.Agent.Transport;
using Inner.Network.Agent.Workers;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkHeartbeatTests
{
    [Fact]
    public async Task Heartbeat_posts_the_existing_backend_shape_and_discovery_fields()
    {
        string? route = null;
        string? payload = null;
        using var http = new HttpClient(new CaptureHandler(request =>
        {
            route = request.RequestUri!.AbsolutePath;
            payload = request.Content!.ReadAsStringAsync().GetAwaiter().GetResult();
            return new HttpResponseMessage(HttpStatusCode.NoContent);
        }));
        var api = new NetworkApiClient(http, "https://api.example.test");
        var heartbeat = new NetworkHeartbeatPayload(DateTimeOffset.Parse("2026-10-19T12:00:00Z"), 12, "1.0.0", 7, 6, 1, 512,
            "success", null, "complete", 3, DateTimeOffset.Parse("2026-10-19T11:59:00Z"));

        await api.SendHeartbeatAsync("access-token", heartbeat);

        Assert.Equal("/api/agent/v1/heartbeat", route);
        using var json = JsonDocument.Parse(payload!);
        Assert.Equal(7, json.RootElement.GetProperty("last_created_sequence").GetInt64());
        Assert.Equal("complete", json.RootElement.GetProperty("discovery_state").GetString());
        Assert.Equal(3, json.RootElement.GetProperty("discovered_devices").GetInt32());
        Assert.Equal(JsonValueKind.Null, json.RootElement.GetProperty("last_error_code").ValueKind);
    }

    [Fact]
    public async Task Heartbeat_failure_does_not_stop_the_independent_cached_collection_loop()
    {
        var calls = 0;
        var collected = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var heartbeat = new NetworkHeartbeatLoop(_ =>
        {
            calls++;
            if (calls == 1) throw new HttpRequestException("offline");
            return Task.CompletedTask;
        }, NullLogger<NetworkHeartbeatLoop>.Instance);
        using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(2));

        var heartbeatTask = heartbeat.RunAsync(cts.Token, TimeSpan.FromMilliseconds(1));
        await Task.Run(async () =>
        {
            await Task.Delay(10, cts.Token);
            collected.TrySetResult();
        }, cts.Token);
        await collected.Task.WaitAsync(cts.Token);
        while (calls < 2) await Task.Delay(5, cts.Token);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => heartbeatTask);

        Assert.True(calls >= 2);
        Assert.True(collected.Task.IsCompletedSuccessfully);
    }

    private sealed class CaptureHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
    }
}
