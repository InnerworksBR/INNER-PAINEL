using System.Net;
using System.Text.Json;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Snmp;
using Inner.Network.Agent.Transport;
using Inner.Network.Agent.Workers;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkCollectionCoordinatorTests
{
    private const string NetworkId = "00000000-0000-4000-8000-000000000010";
    private const string CredentialId = "00000000-0000-4000-8000-000000000020";
    private const string ScopeId = "00000000-0000-4000-8000-000000000030";

    [Fact]
    public async Task Authorization_epoch_change_while_request_waits_for_budget_skips_probe_and_emits_no_timeout()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.UtcNow;
            await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine-a", null, now.AddMinutes(-1), TimeSpan.FromMinutes(15));
            var probe = new FakeProbe((_, _, _) => Task.FromResult<NetworkProbeResult?>(null));
            var coordinator = new NetworkCollectionCoordinator(store, probe);
            var checks = 0;
            var result = await coordinator.PollKnownAsync(Config("192.0.2.0/30"), now,
                isStillAuthorized: () => Interlocked.Increment(ref checks) < 3);

            Assert.Equal(0, probe.Calls);
            Assert.Empty(result.Devices);
            Assert.Empty(await store.ReadPendingAsync(10));
        });
    }

    [Fact]
    public async Task Discovery_does_not_create_inventory_or_enqueue_a_timeout_for_unknown_addresses()
    {
        await WithStore(async store =>
        {
            var probe = new FakeProbe((_, _, _) => Task.FromResult<NetworkProbeResult?>(null));
            var coordinator = new NetworkCollectionCoordinator(store, probe);

            var cycle = await coordinator.RunCycleAsync(Config("192.0.2.0/30"), DateTimeOffset.Parse("2026-10-19T12:00:00Z"));

            Assert.Equal(2, probe.Calls);
            Assert.Equal(0, cycle.DiscoveredDevices);
            Assert.Empty(await store.GetKnownTargetsAsync());
            Assert.Empty(await store.ReadPendingAsync(10));
        });
    }

    [Fact]
    public async Task Successful_discovery_persists_target_and_known_timeout_emits_valid_failure_payload()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            var probe = new FakeProbe((ip, network, _) => Task.FromResult<NetworkProbeResult?>(ip.ToString() == "192.0.2.1"
                ? Success(network.Id, "192.0.2.1", "engine-a") : null));
            var coordinator = new NetworkCollectionCoordinator(store, probe);
            var config = Config("192.0.2.0/30");

            var discovery = await coordinator.RunCycleAsync(config, now);
            Assert.Equal(1, discovery.DiscoveredDevices);
            var target = Assert.Single(await store.GetKnownTargetsAsync());
            var deviceUid = target.DeviceUid.ToString("D");

            probe.Handler = (_, _, _) => Task.FromResult<NetworkProbeResult?>(null);
            var poll = await coordinator.RunCycleAsync(config, now.AddMinutes(1));
            Assert.Equal(0, poll.DiscoveredDevices);
            Assert.Equal(1, poll.CollectedDevices);
            Assert.Equal(deviceUid, Assert.Single(poll.Devices).DeviceUid);
            Assert.Equal("timeout", poll.Devices[0].Result);
            Assert.Empty(poll.Devices[0].Interfaces!);

            var batch = (await store.ReadPendingAsync(10)).OrderBy(b => b.Sequence).Last();
            using var json = JsonDocument.Parse(batch.Payload);
            var device = Assert.Single(json.RootElement.GetProperty("devices").EnumerateArray());
            Assert.Equal("timeout", device.GetProperty("result").GetString());
            Assert.Equal(JsonValueKind.Array, device.GetProperty("interfaces").ValueKind);
            Assert.Equal(0, device.GetProperty("interfaces").GetArrayLength());
        });
    }

    [Theory]
    [InlineData("auth_error")]
    [InlineData("protocol_error")]
    public async Task Known_authentication_and_protocol_failures_keep_their_backend_result_code(string expected)
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", null, null, now.AddHours(-1), TimeSpan.FromMinutes(15));
            var probe = new FakeProbe((_, _, _) => Task.FromException<NetworkProbeResult?>(expected == "auth_error"
                ? new SnmpAuthenticationException("test-only") : new SnmpProtocolException("test-only")));

            var result = await new NetworkCollectionCoordinator(store, probe).PollKnownAsync(Config("192.0.2.0/30"), now);

            Assert.Equal(expected, Assert.Single(result.Devices).Result);
        });
    }

    [Fact]
    public async Task Discovery_interval_is_respected_but_known_targets_are_polled_each_collection_cycle()
    {
        await WithStore(async store =>
        {
            var start = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            var probe = new FakeProbe((ip, network, _) => Task.FromResult<NetworkProbeResult?>(ip.ToString() == "192.0.2.1"
                ? Success(network.Id, ip.ToString(), "engine-a") : null));
            var coordinator = new NetworkCollectionCoordinator(store, probe);
            var config = Config("192.0.2.0/30", discoverySeconds: 900);
            await coordinator.RunCycleAsync(config, start);
            var callsAfterDiscovery = probe.Calls;

            probe.Handler = (_, _, _) => Task.FromResult<NetworkProbeResult?>(null);
            var poll = await coordinator.RunCycleAsync(config, start.AddMinutes(1));

            Assert.Equal(callsAfterDiscovery + 1, probe.Calls);
            Assert.Equal(1, poll.CollectedDevices);
            Assert.Equal(start, poll.LastDiscoveryAt);
        });
    }

    [Fact]
    public async Task Reconciliation_removes_targets_outside_enabled_cidr_exclusions_or_credentials()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            var probe = new FakeProbe((ip, network, _) => Task.FromResult<NetworkProbeResult?>(ip.ToString() == "192.0.2.1"
                ? Success(network.Id, ip.ToString(), "engine-a") : null));
            var coordinator = new NetworkCollectionCoordinator(store, probe);
            var original = Config("192.0.2.0/30");
            await coordinator.RunCycleAsync(original, now);
            Assert.Single(await store.GetKnownTargetsAsync());

            var denied = original with { Networks = [original.Networks[0] with { ExcludedIps = ["192.0.2.1"] }] };
            probe.Handler = (_, _, _) => throw new Xunit.Sdk.XunitException("A deauthorized target must not be probed.");
            var cycle = await coordinator.RunCycleAsync(denied, now.AddMinutes(1));

            Assert.Empty(await store.GetKnownTargetsAsync());
            Assert.Empty(cycle.Devices);
        });
    }

    [Fact]
    public async Task Trusted_unique_identity_survives_ip_move_while_duplicate_claims_do_not_merge()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            var oldConfig = Config("192.0.2.0/30");
            var first = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine-a", "serial-a", now, TimeSpan.FromMinutes(15));
            var moved = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.2", "engine-a", "serial-a", now.AddMinutes(16), TimeSpan.FromMinutes(15));
            Assert.Equal(first, moved);
            Assert.Collection(await store.GetKnownTargetsAsync(), target => Assert.Equal("192.0.2.2", target.IpAddress));

            var duplicate = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine-a", "serial-a", now.AddMinutes(17), TimeSpan.FromMinutes(15));
            Assert.NotEqual(moved, duplicate);
            Assert.Equal(2, (await store.GetKnownTargetsAsync()).Select(t => t.DeviceUid).Distinct().Count());
        });
    }

    [Fact]
    public async Task Pending_discovery_does_not_block_known_polling_or_heartbeat()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.2", "engine-known", "serial-known", now, TimeSpan.FromMinutes(15));
            var discoveryEntered = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var releaseDiscovery = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            var phase = 0;
            var probe = new FakeProbe(async (ip, network, _) =>
            {
                if (ip.ToString() == "192.0.2.1")
                {
                    discoveryEntered.TrySetResult();
                    await releaseDiscovery.Task;
                    return null;
                }
                return Volatile.Read(ref phase) == 0 ? null : Success(network.Id, ip.ToString(), "engine-known");
            });
            var coordinator = new NetworkCollectionCoordinator(store, probe);
            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(3));

            var discoveryTask = coordinator.DiscoverAsync(Config("192.0.2.0/30"), now.AddMinutes(16), cts.Token);
            await discoveryEntered.Task.WaitAsync(cts.Token);
            Volatile.Write(ref phase, 1);

            string? heartbeatRoute = null;
            using var http = new HttpClient(new DelegateHandler(request =>
            {
                heartbeatRoute = request.RequestUri!.AbsolutePath;
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }));
            var api = new NetworkApiClient(http, "https://api.example.test");
            var pollTask = coordinator.PollKnownAsync(Config("192.0.2.0/30"), now.AddMinutes(16), cts.Token);
            var heartbeatTask = api.SendHeartbeatAsync("access-token", new NetworkHeartbeatPayload(now, 60, "1.0.0", 0, 0,
                0, 0, "success", null, "discovering", 0, null), cts.Token);

            var poll = await pollTask.WaitAsync(cts.Token);
            await heartbeatTask.WaitAsync(cts.Token);
            Assert.Equal(1, poll.CollectedDevices);
            Assert.Equal("success", Assert.Single(poll.Devices).Result);
            Assert.Equal("/api/agent/v1/heartbeat", heartbeatRoute);

            releaseDiscovery.TrySetResult();
            await discoveryTask.WaitAsync(cts.Token);
        });
    }

    [Fact]
    public async Task Multiple_trusted_identity_claimants_never_fall_back_to_an_unrelated_ip_alias()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            var first = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.1", "engine-shared", "serial-one", now, TimeSpan.FromMinutes(15));
            var second = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.2", "engine-shared", "serial-two", now.AddMinutes(1), TimeSpan.FromMinutes(15));
            var unrelatedIpIdentity = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.3", null, null, now.AddMinutes(2), TimeSpan.FromMinutes(15));
            await store.RemoveTargetAsync(NetworkId, "192.0.2.3");

            var ambiguous = await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, "192.0.2.3", "engine-shared", "serial-three", now.AddMinutes(3), TimeSpan.FromMinutes(15));

            Assert.NotEqual(first, second);
            Assert.NotEqual(unrelatedIpIdentity, ambiguous);
        });
    }

    [Fact]
    public async Task Large_collection_is_split_under_backend_limit_and_keeps_known_timeout_with_successes()
    {
        await WithStore(async store =>
        {
            var now = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
            const int deviceCount = 12;
            for (var index = 1; index <= deviceCount; index++)
            {
                var address = new IPAddress(new byte[] { 10, 10, 0, (byte)index });
                await store.ResolveAndUpsertTargetAsync(NetworkId, ScopeId, address.ToString(), null, null, now.AddHours(-1), TimeSpan.FromMinutes(15));
            }
            var timeoutIp = "10.10.0.7";
            var probe = new FakeProbe((ip, network, _) => Task.FromResult<NetworkProbeResult?>(ip.ToString() == timeoutIp
                ? null
                : new NetworkProbeResult(new NetworkDeviceMetric(network.Id, string.Empty, ip.ToString(), "switch", "Switch", now,
                    "success", SysDescription: new string('x', 4096), Interfaces: Enumerable.Range(1, 800)
                        .Select(index => new NetworkInterfaceMetric(index, new string('n', 255), new string('d', 255),
                            "00:11:22:33:44:55", 1, 1, 1_000_000_000, "4294967298", "9007199254741001", "2", "3", "4", "5", 2048, 512, 6)).ToArray()), null, null)));
            var config = new NetworkAgentConfiguration(1, true, 60, 900,
                [new NetworkDefinition(NetworkId, "10.10.0.0/20", true, 161, [], [CredentialId], ScopeId)],
                [new SnmpCredential(CredentialId, "readonly", "2c", Community: "test-only")]);
            var coordinator = new NetworkCollectionCoordinator(store, probe);

            var result = await coordinator.PollKnownAsync(config, now);
            var batches = await store.ReadPendingAsync(200);
            var payloads = batches.Select(batch => JsonDocument.Parse(batch.Payload)).ToArray();
            try
            {
                Assert.Equal(deviceCount, result.CollectedDevices);
                Assert.Equal(deviceCount, payloads.Sum(payload => payload.RootElement.GetProperty("devices").GetArrayLength()));
                Assert.All(batches, batch => Assert.True(System.Text.Encoding.UTF8.GetByteCount(batch.Payload) < 4 * 1024 * 1024));
                Assert.True(batches.Count > 1);
                Assert.Equal(batches.Select(batch => batch.Sequence).Order(), batches.Select(batch => batch.Sequence));
                var devices = payloads.SelectMany(payload => payload.RootElement.GetProperty("devices").EnumerateArray()).ToArray();
                var failed = Assert.Single(devices, device => device.GetProperty("result").GetString() == "timeout");
                Assert.Equal(timeoutIp, failed.GetProperty("ip_address").GetString());
                Assert.Equal(JsonValueKind.Array, failed.GetProperty("interfaces").ValueKind);
                Assert.All(devices.Where(device => device.GetProperty("result").GetString() == "success"),
                    device => Assert.Equal(800, device.GetProperty("interfaces").GetArrayLength()));
            }
            finally { foreach (var payload in payloads) payload.Dispose(); }
        });
    }

    private static NetworkAgentConfiguration Config(string cidr, int discoverySeconds = 900) => new(
        1, true, 60, discoverySeconds,
        [new NetworkDefinition(NetworkId, cidr, true, 161, [], [CredentialId], ScopeId)],
        [new SnmpCredential(CredentialId, "readonly", "2c", Community: "test-only")]);

    private static NetworkProbeResult Success(string networkId, string ip, string engineId) => new(
        new NetworkDeviceMetric(networkId, string.Empty, ip, "switch", "Switch", DateTimeOffset.UtcNow, "success", EngineId: engineId, Interfaces: []), engineId, null);

    private static async Task WithStore(Func<NetworkAgentStore, Task> body)
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-coordinator-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            await body(store);
        }
        finally
        {
            foreach (var file in new[] { path, path + "-shm", path + "-wal" }) if (File.Exists(file)) File.Delete(file);
        }
    }

    private sealed class FakeProbe(Func<IPAddress, NetworkDefinition, IReadOnlyList<SnmpCredential>, Task<NetworkProbeResult?>> handler) : INetworkDeviceProbe
    {
        public int Calls { get; private set; }
        public Func<IPAddress, NetworkDefinition, IReadOnlyList<SnmpCredential>, Task<NetworkProbeResult?>> Handler { get; set; } = handler;

        public Task<NetworkProbeResult?> ProbeAsync(IPAddress ip, NetworkDefinition network, IReadOnlyList<SnmpCredential> credentials, CancellationToken ct = default)
        {
            Calls++;
            return Handler(ip, network, credentials);
        }
    }

    private sealed class DelegateHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => Task.FromResult(respond(request));
    }
}
