using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using Inner.Network.Agent.Discovery;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Snmp;
using Inner.Network.Agent.Transport;

namespace Inner.Network.Agent.Workers;

public sealed record NetworkProbeResult(NetworkDeviceMetric Metric, string? EngineId, string? SerialNumber, Guid? DeviceUid = null);

public interface INetworkDeviceProbe
{
    Task<NetworkProbeResult?> ProbeAsync(IPAddress ip, NetworkDefinition network,
        IReadOnlyList<SnmpCredential> credentials, CancellationToken ct = default);
}

public sealed record NetworkCollectionCycleResult(
    IReadOnlyList<NetworkDeviceMetric> Devices,
    int DiscoveredDevices,
    int CollectedDevices,
    DateTimeOffset? LastDiscoveryAt,
    string DiscoveryState);

public sealed class NetworkCollectionCoordinator
{
    private const int MaxConcurrentRequests = 16;
    private const int MaxBatchBytes = 3_800_000;
    private const int MaxDevicesPerBatch = 5_000;
    // Keep one request slot available for already-known devices while broad
    // discovery runs. Both paths still share the same hard 16-request limit.
    private const int MaxConcurrentDiscoveryRequests = MaxConcurrentRequests - 1;
    private readonly NetworkAgentStore _store;
    private readonly INetworkDeviceProbe _probe;
    private readonly SemaphoreSlim _requestBudget = new(MaxConcurrentRequests, MaxConcurrentRequests);

    public NetworkCollectionCoordinator(NetworkAgentStore store, INetworkDeviceProbe probe)
    {
        _store = store;
        _probe = probe;
    }

    public async Task<NetworkCollectionCycleResult> RunCycleAsync(NetworkAgentConfiguration config, DateTimeOffset now, CancellationToken ct = default)
    {
        var discovery = await DiscoverAsync(config, now, ct);
        var polled = await PollKnownAsync(config, now, ct);
        return new(discovery.Devices.Concat(polled.Devices).ToArray(), discovery.DiscoveredDevices, polled.CollectedDevices,
            polled.LastDiscoveryAt, discovery.DiscoveryState);
    }

    public async Task<NetworkCollectionCycleResult> DiscoverAsync(NetworkAgentConfiguration config, DateTimeOffset now, CancellationToken ct = default)
    {
        await ReconcileAuthorizedTargetsAsync(config, ct);
        var lastDiscovery = await _store.GetLastDiscoveryAtAsync(ct);
        var lastVersion = await _store.GetLastDiscoveryConfigVersionAsync(ct);
        var discoveryInterval = TimeSpan.FromSeconds(Math.Clamp(config.DiscoveryIntervalSeconds, 60, 86_400));
        if (lastDiscovery is not null && lastVersion == config.Version && now - lastDiscovery < discoveryInterval)
            return new([], 0, 0, lastDiscovery, await _store.GetDiscoveryStateAsync(ct));

        await _store.SaveDiscoveryStateAsync("discovering", ct);
        var discovered = new List<NetworkDeviceMetric>();
        try
        {
            var networks = EligibleNetworks(config).ToArray();
            var ips = new NetworkRangePlanner(4096).ExpandDistinct(networks.Select(n => n.Cidr));
            var work = ips.Select(ip => (Ip: ip, Network: networks.First(n => Contains(n.Cidr, ip))))
                .Where(item => !item.Network.ExcludedIps.Contains(item.Ip.ToString(), StringComparer.OrdinalIgnoreCase))
                .ToArray();
            for (var offset = 0; offset < work.Length; offset += MaxConcurrentDiscoveryRequests)
            {
                var chunk = work.Skip(offset).Take(MaxConcurrentDiscoveryRequests).ToArray();
                var results = await Task.WhenAll(chunk.Select(item => DiscoverOneAsync(item.Ip, item.Network, config, now, ct)));
                discovered.AddRange(results.Where(result => result is not null).Select(result => result!));
            }
            await _store.MarkDiscoveryCompleteAsync(now, discovered.Select(d => d.DeviceUid).Distinct(StringComparer.OrdinalIgnoreCase).Count(), config.Version, ct);
            await EnqueueAsync(discovered, ct);
            return new(discovered, discovered.Select(d => d.DeviceUid).Distinct(StringComparer.OrdinalIgnoreCase).Count(), discovered.Count,
                now, "complete");
        }
        catch
        {
            if (!ct.IsCancellationRequested) await _store.SaveDiscoveryStateAsync("failed", CancellationToken.None);
            throw;
        }
    }

    public async Task<NetworkCollectionCycleResult> PollKnownAsync(NetworkAgentConfiguration config, DateTimeOffset now, CancellationToken ct = default)
    {
        await ReconcileAuthorizedTargetsAsync(config, ct);
        var networks = config.Networks.Where(n => n.Enabled).ToDictionary(n => n.Id, StringComparer.OrdinalIgnoreCase);
        var targets = (await _store.GetKnownTargetsAsync(ct))
            .Where(t => networks.ContainsKey(t.NetworkId) && t.LastSuccessAt < now.AddSeconds(-1))
            .ToArray();
        var devices = new List<NetworkDeviceMetric>();
        for (var offset = 0; offset < targets.Length; offset += MaxConcurrentRequests)
        {
            var chunk = targets.Skip(offset).Take(MaxConcurrentRequests).ToArray();
            var polled = await Task.WhenAll(chunk.Select(target => PollOneAsync(target, networks[target.NetworkId], config, now, ct)));
            devices.AddRange(polled);
        }
        await EnqueueAsync(devices, ct);
        return new(devices, 0, devices.Count, await _store.GetLastDiscoveryAtAsync(ct), await _store.GetDiscoveryStateAsync(ct));
    }

    private async Task<NetworkDeviceMetric?> DiscoverOneAsync(IPAddress ip, NetworkDefinition network,
        NetworkAgentConfiguration config, DateTimeOffset now, CancellationToken ct)
    {
        try
        {
            var result = await ProbeBoundedAsync(ip, network, GetCredentials(network, config), ct);
            if (result is null) return null;
            var uid = result.DeviceUid ?? await _store.ResolveAndUpsertTargetAsync(network.Id, network.NetworkScopeId ?? network.Id,
                ip.ToString(), result.EngineId, result.SerialNumber, now,
                TimeSpan.FromSeconds(Math.Clamp(config.DiscoveryIntervalSeconds, 60, 86_400)), ct);
            return result.Metric with { DeviceUid = uid.ToString("D") };
        }
        catch (Exception ex) when (IsTargetFailure(ex, ct)) { return null; }
    }

    private async Task<NetworkDeviceMetric> PollOneAsync(NetworkTarget target, NetworkDefinition network,
        NetworkAgentConfiguration config, DateTimeOffset now, CancellationToken ct)
    {
        var ip = IPAddress.Parse(target.IpAddress);
        var failureResult = "timeout";
        try
        {
            var result = await ProbeBoundedAsync(ip, network, GetCredentials(network, config), ct);
            if (result is not null)
            {
                var uid = result.DeviceUid ?? await _store.ResolveAndUpsertTargetAsync(network.Id, network.NetworkScopeId ?? network.Id,
                    target.IpAddress, result.EngineId, result.SerialNumber, now,
                    TimeSpan.FromSeconds(Math.Clamp(config.DiscoveryIntervalSeconds, 60, 86_400)), ct);
                return result.Metric with { DeviceUid = uid.ToString("D") };
            }
        }
        catch (Exception ex) when (IsTargetFailure(ex, ct))
        {
            failureResult = ex is SnmpAuthenticationException ? "auth_error" : ex is SnmpProtocolException ? "protocol_error" : "timeout";
        }
        return new NetworkDeviceMetric(network.Id, target.DeviceUid.ToString("D"), target.IpAddress,
            target.IpAddress, "Outro", now, failureResult, Interfaces: []);
    }

    private async Task<NetworkProbeResult?> ProbeBoundedAsync(IPAddress ip, NetworkDefinition network,
        IReadOnlyList<SnmpCredential> credentials, CancellationToken ct)
    {
        await _requestBudget.WaitAsync(ct);
        try { return await _probe.ProbeAsync(ip, network, credentials, ct); }
        finally { _requestBudget.Release(); }
    }

    private async Task ReconcileAuthorizedTargetsAsync(NetworkAgentConfiguration config, CancellationToken ct)
    {
        var networks = config.Networks.ToDictionary(n => n.Id, StringComparer.OrdinalIgnoreCase);
        foreach (var target in await _store.GetKnownTargetsAsync(ct))
        {
            if (!networks.TryGetValue(target.NetworkId, out var network) || !IsAuthorized(target.IpAddress, network, config))
                await _store.RemoveTargetAsync(target.NetworkId, target.IpAddress, ct);
        }
    }

    private static IEnumerable<NetworkDefinition> EligibleNetworks(NetworkAgentConfiguration config) =>
        config.Networks.Where(n => n.Enabled && n.CredentialIds.Count > 0 && config.Credentials.Any(c => n.CredentialIds.Contains(c.Id)));

    private static IReadOnlyList<SnmpCredential> GetCredentials(NetworkDefinition network, NetworkAgentConfiguration config) =>
        config.Credentials.Where(c => network.CredentialIds.Contains(c.Id)).Take(4).ToArray();

    private static bool IsAuthorized(string ipAddress, NetworkDefinition network, NetworkAgentConfiguration config) => network.Enabled &&
        network.CredentialIds.Any(id => config.Credentials.Any(c => c.Id == id)) && IPAddress.TryParse(ipAddress, out var ip) && Contains(network.Cidr, ip) &&
        !network.ExcludedIps.Contains(ipAddress, StringComparer.OrdinalIgnoreCase);

    private static bool Contains(string cidr, IPAddress candidate)
    {
        var parts = cidr.Split('/');
        if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var baseIp) || baseIp.AddressFamily != System.Net.Sockets.AddressFamily.InterNetwork ||
            !int.TryParse(parts[1], out var prefix) || prefix is < 0 or > 32) return false;
        var left = baseIp.GetAddressBytes();
        var right = candidate.GetAddressBytes();
        if (right.Length != 4) return false;
        for (var i = 0; i < 4; i++)
        {
            var bits = Math.Clamp(prefix - (i * 8), 0, 8);
            var mask = bits == 0 ? 0 : 0xff << (8 - bits);
            if ((left[i] & mask) != (right[i] & mask)) return false;
        }
        return true;
    }

    private async Task EnqueueAsync(IReadOnlyList<NetworkDeviceMetric> devices, CancellationToken ct)
    {
        if (devices.Count == 0) return;
        var chunk = new List<NetworkDeviceMetric>();
        foreach (var device in devices)
        {
            var candidate = chunk.Append(device).ToArray();
            var payload = NetworkMetricsJson.Serialize(new NetworkMetricBatch(long.MaxValue, DateTimeOffset.UtcNow, candidate));
            if (Encoding.UTF8.GetByteCount(payload) > MaxBatchBytes || candidate.Length > MaxDevicesPerBatch)
            {
                if (chunk.Count == 0)
                    throw new InvalidOperationException("A single network observation exceeds the safe backend batch size; it was not truncated or placed in the outbox.");
                await PersistChunkAsync(chunk, ct);
                chunk.Clear();
                chunk.Add(device);
                var single = NetworkMetricsJson.Serialize(new NetworkMetricBatch(long.MaxValue, DateTimeOffset.UtcNow, chunk));
                if (Encoding.UTF8.GetByteCount(single) > MaxBatchBytes)
                    throw new InvalidOperationException("A single network observation exceeds the safe backend batch size; it was not truncated or placed in the outbox.");
            }
            else chunk.Add(device);
        }
        if (chunk.Count > 0) await PersistChunkAsync(chunk, ct);
    }

    private async Task PersistChunkAsync(IReadOnlyList<NetworkDeviceMetric> devices, CancellationToken ct)
    {
        var sequence = await _store.NextSequenceAsync(ct);
        var payload = NetworkMetricsJson.Serialize(new NetworkMetricBatch(sequence, DateTimeOffset.UtcNow, devices));
        if (Encoding.UTF8.GetByteCount(payload) > MaxBatchBytes)
            throw new InvalidOperationException("Serialized network batch exceeded the safe backend batch size.");
        await _store.EnqueueAsync(sequence, payload, ct);
    }

    private static bool IsTargetFailure(Exception ex, CancellationToken ct) => !ct.IsCancellationRequested &&
        ex is TimeoutException or SocketException or SnmpProtocolException or SnmpAuthenticationException or ArgumentException;
}
