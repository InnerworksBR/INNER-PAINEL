using System.Net;
using System.Text;
using System.Text.Json;
using System.Reflection;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Security;
using Inner.Network.Agent.Transport;
using Inner.Network.Agent.Workers;
using Xunit;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkAuthorizationLifecycleTests
{
    private const string NetworkId = "00000000-0000-4000-8000-000000000010";
    private const string CredentialId = "00000000-0000-4000-8000-000000000020";
    private const string ScopeId = "00000000-0000-4000-8000-000000000030";

    [Fact]
    public async Task Expired_access_then_invalid_refresh_durably_requires_relink_and_stops_cached_collection()
    {
        var secrets = EnrolledSecrets();
        secrets.Save("configuration_cache", "old-company-config");
        using var http = new HttpClient(new QueueHandler((request, _) => Task.FromResult(request.Method == HttpMethod.Get
            ? Response(HttpStatusCode.Unauthorized, "{\"error\":\"Token do agente inválido ou expirado.\"}")
            : Response(HttpStatusCode.Unauthorized, "{\"error\":\"Refresh token inválido ou revogado.\"}"))));
        var api = new NetworkApiClient(http, "https://api.example.test");
        var lifecycle = new NetworkAgentAuthorizationLifecycle(secrets);

        await Assert.ThrowsAsync<NetworkApiException>(() => api.GetConfigurationAsync("expired-access"));
        var result = await lifecycle.RefreshAfterAccessRejectedAsync(new NetworkTokenRefreshCoordinator(api, secrets), "expired-access");

        Assert.Null(result);
        Assert.True(lifecycle.AuthorizationLost);
        Assert.False(lifecycle.CanUseCachedQueries);
        Assert.Null(secrets.Read("agent_id"));
        Assert.Null(secrets.Read("refresh_token"));
        var restarted = new NetworkAgentAuthorizationLifecycle(secrets);
        Assert.True(restarted.AuthorizationLost);
        Assert.False(restarted.CanUseCachedQueries);
        Assert.Null(secrets.Read("configuration_cache"));

        secrets.Save("agent_id", "agent-new-company");
        secrets.Save("company_id", "company-new");
        restarted.ClearAfterSuccessfulRelink();
        Assert.Null(secrets.Read("configuration_cache"));
    }

    [Fact]
    public async Task Transient_refresh_failure_keeps_cached_known_device_polling_active()
    {
        var secrets = EnrolledSecrets();
        secrets.Save("configuration_cache", "same-enrollment-config");
        using var http = new HttpClient(new QueueHandler((request, _) => Task.FromResult(request.Method == HttpMethod.Get
            ? Response(HttpStatusCode.Unauthorized, "{\"error\":\"Token do agente inválido ou expirado.\"}")
            : Response(HttpStatusCode.ServiceUnavailable, "temporarily unavailable"))));
        var api = new NetworkApiClient(http, "https://api.example.test");
        var lifecycle = new NetworkAgentAuthorizationLifecycle(secrets);
        await Assert.ThrowsAsync<NetworkApiException>(() => api.GetConfigurationAsync("expired-access"));
        await Assert.ThrowsAsync<NetworkApiException>(() => lifecycle.RefreshAfterAccessRejectedAsync(
            new NetworkTokenRefreshCoordinator(api, secrets), "expired-access"));

        Assert.False(lifecycle.AuthorizationLost);
        Assert.True(lifecycle.CanUseCachedQueries);
        Assert.Equal("same-enrollment-config", secrets.Read("configuration_cache"));
        var path = Path.Combine(Path.GetTempPath(), $"network-auth-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            var now = DateTimeOffset.UtcNow;
            await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine", null, now.AddMinutes(-1), TimeSpan.FromMinutes(15));
            var collector = new NetworkCollectionCoordinator(store, new SuccessfulProbe());
            var result = await collector.PollKnownAsync(Config(), now);
            Assert.Single(result.Devices);
            Assert.Equal("success", result.Devices[0].Result);
        }
        finally
        {
            foreach (var suffix in new[] { "", "-shm", "-wal" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }

    [Fact]
    public async Task Successful_refresh_after_expired_access_does_not_set_relink_state()
    {
        var secrets = EnrolledSecrets();
        using var http = new HttpClient(new QueueHandler((request, _) => Task.FromResult(request.Method == HttpMethod.Get
            ? Response(HttpStatusCode.Unauthorized, "{\"error\":\"Token do agente inválido ou expirado.\"}")
            : Response(HttpStatusCode.OK, "{\"agent_id\":\"agent-1\",\"company_id\":\"company-1\",\"access_token\":\"access-new\",\"expires_in\":600}"))));
        var api = new NetworkApiClient(http, "https://api.example.test");
        var lifecycle = new NetworkAgentAuthorizationLifecycle(secrets);

        await Assert.ThrowsAsync<NetworkApiException>(() => api.GetConfigurationAsync("expired-access"));
        var result = await lifecycle.RefreshAfterAccessRejectedAsync(new NetworkTokenRefreshCoordinator(api, secrets), "expired-access");

        Assert.Equal("access-new", result!.AccessToken);
        Assert.False(lifecycle.AuthorizationLost);
        Assert.True(lifecycle.CanUseCachedQueries);
    }

    [Fact]
    public async Task Worker_collection_loop_stays_closed_after_new_company_pairing_until_fresh_configuration()
    {
        var secrets = EnrolledSecrets();
        new NetworkConfigurationCache(secrets).Replace(Config());
        var lifecycle = new NetworkAgentAuthorizationLifecycle(secrets);
        var path = Path.Combine(Path.GetTempPath(), $"network-worker-auth-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            var now = DateTimeOffset.UtcNow;
            await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine-old", null, now, TimeSpan.FromMinutes(15));
            var probe = new CountingProbe();
            var worker = new NetworkAgentWorker(NullLogger<NetworkAgentWorker>.Instance,
                new ConfigurationBuilder().AddInMemoryCollection().Build());
            Set(worker, "_secrets", secrets);
            Set(worker, "_authorization", lifecycle);
            Set(worker, "_collector", new NetworkCollectionCoordinator(store, probe));

            // This is the persisted outcome of a definitive refresh 401. Pairing changes tenant,
            // but a configuration 503 leaves no authorized configuration to use in the worker loop.
            lifecycle.MarkAuthorizationLost();
            secrets.Save("agent_id", "agent-new-company");
            secrets.Save("company_id", "company-new");
            lifecycle.ClearAfterSuccessfulRelink();
            await RunCollectionLoopOnceAsync(worker);
            Assert.Equal(0, probe.Count);

            var newNetworkId = "00000000-0000-4000-8000-000000000099";
            var newScopeId = "00000000-0000-4000-8000-000000000098";
            var newConfig = new NetworkAgentConfiguration(2, true, 30, 900,
                [new NetworkDefinition(newNetworkId, "192.0.2.0/24", true, 161, [], [CredentialId], newScopeId)],
                [new SnmpCredential(CredentialId, "readonly", "2c", Community: "new-company-community")]);
            await store.ResolveAndUpsertTargetAsync(newNetworkId, newScopeId, "192.0.2.2", "engine-new", null, now.AddMinutes(-1), TimeSpan.FromMinutes(15));
            new NetworkConfigurationCache(secrets).Replace(newConfig);
            await RunCollectionLoopOnceAsync(worker);
            Assert.Equal(1, probe.Count);
        }
        finally
        {
            foreach (var suffix in new[] { "", "-shm", "-wal" }) if (File.Exists(path + suffix)) File.Delete(path + suffix);
        }
    }

    private static void Set(object target, string field, object value) =>
        typeof(NetworkAgentWorker).GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(target, value);

    private static async Task RunCollectionLoopOnceAsync(NetworkAgentWorker worker)
    {
        using var cts = new CancellationTokenSource();
        var method = typeof(NetworkAgentWorker).GetMethod("CollectionLoopAsync", BindingFlags.Instance | BindingFlags.NonPublic)!;
        var task = (Task)method.Invoke(worker, [cts.Token])!;
        await Task.Delay(150);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => task);
    }

    private static MemorySecretStore EnrolledSecrets()
    {
        var secrets = new MemorySecretStore();
        secrets.Save("agent_id", "agent-1");
        secrets.Save("company_id", "company-1");
        secrets.Save("access_token", "expired-access");
        secrets.Save("refresh_token", "refresh-old");
        return secrets;
    }

    private static NetworkAgentConfiguration Config() => new(1, true, 60, 900,
        [new NetworkDefinition(NetworkId, "192.0.2.0/24", true, 161, [], [CredentialId], ScopeId)],
        [new SnmpCredential(CredentialId, "readonly", "2c", Community: "community")]);

    private static HttpResponseMessage Response(HttpStatusCode status, string body) => new(status)
    {
        Content = new StringContent(body, Encoding.UTF8, "application/json")
    };

    private sealed class QueueHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> action) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => action(request, cancellationToken);
    }

    private sealed class MemorySecretStore : INetworkSecretStore
    {
        private readonly Dictionary<string, string> _values = new();
        public void Save(string key, string value) => _values[key] = value;
        public string? Read(string key) => _values.GetValueOrDefault(key);
        public void Delete(string key) => _values.Remove(key);
    }

    private sealed class SuccessfulProbe : INetworkDeviceProbe
    {
        public Task<NetworkProbeResult?> ProbeAsync(IPAddress ip, NetworkDefinition network, IReadOnlyList<SnmpCredential> credentials, CancellationToken ct = default) =>
            Task.FromResult<NetworkProbeResult?>(new(new NetworkDeviceMetric(network.Id, "", ip.ToString(), "device", "Switch", DateTimeOffset.UtcNow, "success", Interfaces: []), "engine", null));
    }

    private sealed class CountingProbe : INetworkDeviceProbe
    {
        public int Count;
        public Task<NetworkProbeResult?> ProbeAsync(IPAddress ip, NetworkDefinition network, IReadOnlyList<SnmpCredential> credentials, CancellationToken ct = default)
        {
            Interlocked.Increment(ref Count);
            return Task.FromResult<NetworkProbeResult?>(new(new NetworkDeviceMetric(network.Id, "", ip.ToString(), "device", "Switch", DateTimeOffset.UtcNow, "success", Interfaces: []), "engine-new", null));
        }
    }
}
