using System.Diagnostics;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Text.Json;
using System.Text.Json.Serialization;
using Inner.Network.Agent.Discovery;
using Inner.Network.Agent.Metrics;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Security;
using Inner.Network.Agent.Snmp;
using Inner.Network.Agent.Transport;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Inner.Network.Agent.Workers;

public sealed record NetworkMetricBatch(long Sequence, DateTimeOffset CollectedAt, IReadOnlyList<NetworkDeviceMetric> Devices);
public sealed record NetworkDeviceMetric(
    string NetworkId, string DeviceUid, string IpAddress, string DeviceName, string DeviceType,
    DateTimeOffset ObservedAt, string Result, string? SysObjectId = null, string? SysDescription = null,
    long? UptimeSeconds = null, double? ResponseTimeMs = null, string? Manufacturer = null,
    string? Model = null, string? SerialNumber = null, string? FirmwareVersion = null,
    string? Location = null, string? EngineId = null, IReadOnlyList<NetworkInterfaceMetric>? Interfaces = null);
public sealed record NetworkInterfaceMetric(
    int IfIndex, string Name, string? Description = null, string? MacAddress = null,
    int? AdminStatus = null, int? OperStatus = null, long? SpeedBps = null,
    string? InOctets = null, string? OutOctets = null, string? InErrors = null,
    string? OutErrors = null, string? InDiscards = null, string? OutDiscards = null,
    double? InBps = null, double? OutBps = null);

public sealed class NetworkAgentWorker(
    ILogger<NetworkAgentWorker> logger,
    IConfiguration configuration) : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private readonly string _dataDirectory = configuration["Agent:DataDirectory"] ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "InnerWorks", "NetworkAgent");
    private NetworkAgentStore _store = null!;
    private NetworkSecretStore _secrets = null!;
    private NetworkApiClient _api = null!;
    private SnmpClient _snmp = null!;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(_dataDirectory);
        _store = new NetworkAgentStore(Path.Combine(_dataDirectory, "network-agent.db"));
        await _store.InitializeAsync(stoppingToken);
        _secrets = new NetworkSecretStore(Path.Combine(_dataDirectory, "secrets"));
        _api = new NetworkApiClient(new HttpClient { Timeout = TimeSpan.FromSeconds(15) }, configuration["Agent:ApiBaseUrl"] ?? "https://innerworks-painelbackend.zvzr4n.easypanel.host");
        _snmp = new SnmpClient();
        var provisioning = ProvisionAndConfigureAsync(stoppingToken);
        var collection = CollectionLoopAsync(stoppingToken);
        var sending = SendingLoopAsync(stoppingToken);
        await Task.WhenAll(provisioning, collection, sending);
    }

    private async Task ProvisionAndConfigureAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                if (_secrets.Read("refresh_token") is null)
                    await PairUntilApprovedAsync(ct);

                if (_secrets.Read("access_token") is null)
                    await RefreshAccessAsync(ct);

                var access = _secrets.Read("access_token");
                if (access is not null)
                {
                    try
                    {
                        var current = await _api.GetConfigurationAsync(access, ct);
                        await PersistConfigurationAsync(current, ct);
                    }
                    catch (NetworkApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
                    {
                        await RefreshAccessAsync(ct);
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Network agent provisioning/config refresh deferred: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(60), ct);
        }
    }

    private async Task PairUntilApprovedAsync(CancellationToken ct)
    {
        var pairingId = _secrets.Read("pairing_id");
        var deviceSecret = _secrets.Read("device_secret");
        if (pairingId is null || deviceSecret is null)
        {
            var request = new PairingRequest(await _store.GetOrCreateMachineIdAsync(ct), Environment.MachineName, "1.0.0", Environment.OSVersion.VersionString, GetDetectedNetworks());
            var pairing = await _api.CreatePairingAsync(request, ct);
            pairingId = pairing.PairingId;
            deviceSecret = pairing.DeviceSecret;
            _secrets.Save("pairing_id", pairingId);
            _secrets.Save("device_secret", deviceSecret);
            WritePairingStatus(pairing.UserCode, pairing.ExpiresAt, pairing.VerificationUrl, "pending");
            logger.LogInformation("Pairing code {UserCode} valid until {ExpiresAt:u}. Open {VerificationUrl} and claim this agent.", pairing.UserCode, pairing.ExpiresAt, pairing.VerificationUrl);
        }

        while (!ct.IsCancellationRequested && _secrets.Read("refresh_token") is null)
        {
            var status = await _api.GetPairingStatusAsync(pairingId, deviceSecret, ct);
            if (status.State == "approved")
            {
                var credentials = await new PairingCoordinator(_api, _secrets).CompleteAsync(pairingId, deviceSecret, ct);
                _secrets.Save("agent_id", credentials.AgentId);
                _secrets.Save("company_id", credentials.CompanyId);
                _secrets.Delete("pairing_id");
                _secrets.Delete("device_secret");
                WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "completed");
                return;
            }
            if (status.State is "expired" or "completed")
            {
                _secrets.Delete("pairing_id");
                _secrets.Delete("device_secret");
                WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, status.State);
                return;
            }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    private async Task RefreshAccessAsync(CancellationToken ct)
    {
        try
        {
            var credentials = await new NetworkTokenManager(_api, _secrets).RefreshAsync(ct);
            if (!string.IsNullOrWhiteSpace(credentials.AgentId)) _secrets.Save("agent_id", credentials.AgentId);
            if (!string.IsNullOrWhiteSpace(credentials.CompanyId)) _secrets.Save("company_id", credentials.CompanyId);
        }
        catch (Exception ex) { logger.LogWarning("Access token refresh deferred: {ErrorType}", ex.GetType().Name); }
    }

    private async Task PersistConfigurationAsync(NetworkAgentConfiguration config, CancellationToken ct)
    {
        if (config.Version < 0 || config.Networks.Count > 256 || config.Credentials.Count > 1024)
            throw new InvalidOperationException("Server returned configuration outside collector limits.");
        var normalized = JsonSerializer.Serialize(config, JsonOptions);
        _secrets.Save("configuration_cache", normalized);
        await _store.SaveConfigurationAsync(JsonSerializer.Serialize(new { config.Version, config.Enabled }, JsonOptions), ct);
    }

    private async Task CollectionLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var delaySeconds = 60;
            try
            {
                var json = _secrets.Read("configuration_cache");
                if (json is not null)
                {
                    var config = JsonSerializer.Deserialize<NetworkAgentConfiguration>(json, JsonOptions);
                    if (config is { Enabled: true })
                    {
                        delaySeconds = Math.Clamp(config.CollectionIntervalSeconds, 30, 3600);
                        await CollectOnceAsync(config, ct);
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Network collection cycle failed; cached configuration remains active: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);
        }
    }

    private async Task CollectOnceAsync(NetworkAgentConfiguration config, CancellationToken ct)
    {
        var activeNetworks = config.Networks.Where(n => n.Enabled).ToArray();
        var ips = new NetworkRangePlanner(4096).ExpandDistinct(activeNetworks.Select(n => n.Cidr));
        var byIp = ips.ToDictionary(ip => ip.ToString(), ip => activeNetworks.First(n => Contains(n.Cidr, ip)), StringComparer.OrdinalIgnoreCase);
        var results = new System.Collections.Concurrent.ConcurrentBag<NetworkDeviceMetric>();
        using var concurrency = new SemaphoreSlim(16, 16);
        var tasks = ips.Select(async ip =>
        {
            var ipText = ip.ToString();
            var network = byIp[ipText];
            if (network.ExcludedIps.Contains(ipText, StringComparer.OrdinalIgnoreCase)) return;
            await concurrency.WaitAsync(ct);
            try { results.Add(await CollectDeviceAsync(ip, network, config, ct)); }
            finally { concurrency.Release(); }
        });
        await Task.WhenAll(tasks);
        var sequence = await _store.NextSequenceAsync(ct);
        var batch = new NetworkMetricBatch(sequence, DateTimeOffset.UtcNow, results.OrderBy(d => d.IpAddress, StringComparer.Ordinal).ToArray());
        await _store.EnqueueAsync(sequence, JsonSerializer.Serialize(batch, JsonOptions), ct);
    }

    private async Task<NetworkDeviceMetric> CollectDeviceAsync(IPAddress ip, NetworkDefinition network, NetworkAgentConfiguration config, CancellationToken ct)
    {
        var started = Stopwatch.GetTimestamp();
        var endpoint = new IPEndPoint(ip, Math.Clamp(network.SnmpPort, 1, 65535));
        Exception? lastError = null;
        foreach (var credential in config.Credentials.Where(c => network.CredentialIds.Contains(c.Id)).Take(4))
        {
            try
            {
                var values = await RetryOnceAsync(() => _snmp.GetAsync(endpoint, credential,
                    ["1.3.6.1.2.1.1.1.0", "1.3.6.1.2.1.1.2.0", "1.3.6.1.2.1.1.3.0", "1.3.6.1.2.1.1.5.0", "1.3.6.1.2.1.1.6.0"], TimeSpan.FromSeconds(2), ct), ct);
                var valuesByOid = values.ToDictionary(v => v.Oid, v => v.Value);
                var engineId = values.FirstOrDefault(v => v.Oid == "1.3.6.1.6.3.10.2.1.1.0")?.Value;
                var name = valuesByOid.GetValueOrDefault("1.3.6.1.2.1.1.5.0");
                var description = valuesByOid.GetValueOrDefault("1.3.6.1.2.1.1.1.0");
                var uptime = ParseUnsigned(valuesByOid.GetValueOrDefault("1.3.6.1.2.1.1.3.0"));
                var scope = network.NetworkScopeId ?? network.Id;
                var deviceId = await _store.GetOrCreateDeviceIdAsync(scope, ip.ToString(), engineId, ct);
                var interfaces = await CollectInterfacesAsync(endpoint, credential, deviceId, (ulong)Math.Max(0, uptime ?? 0), ct);
                return new(network.Id, deviceId.ToString("D"), ip.ToString(), string.IsNullOrWhiteSpace(name) ? ip.ToString() : name,
                    Classify(description), DateTimeOffset.UtcNow, values.Count >= 2 ? "success" : "partial",
                    valuesByOid.GetValueOrDefault("1.3.6.1.2.1.1.2.0"), description,
                    uptime is null ? null : uptime.Value / 100,
                    Stopwatch.GetElapsedTime(started).TotalMilliseconds, EngineId: engineId, Location: valuesByOid.GetValueOrDefault("1.3.6.1.2.1.1.6.0"), Interfaces: interfaces);
            }
            catch (Exception ex) when (ex is TimeoutException or SnmpProtocolException or SnmpAuthenticationException or ArgumentException)
            {
                lastError = ex;
                if (ex is SnmpAuthenticationException) continue;
            }
        }
        var uid = await _store.GetOrCreateDeviceIdAsync(network.NetworkScopeId ?? network.Id, ip.ToString(), null, ct);
        var outcome = lastError is SnmpAuthenticationException ? "auth_error" : lastError is SnmpProtocolException ? "protocol_error" : "timeout";
        return new(network.Id, uid.ToString("D"), ip.ToString(), ip.ToString(), "Outro", DateTimeOffset.UtcNow, outcome,
            ResponseTimeMs: null);
    }

    private async Task<IReadOnlyList<NetworkInterfaceMetric>> CollectInterfacesAsync(IPEndPoint endpoint, SnmpCredential credential, Guid deviceId, ulong uptimeTicks, CancellationToken ct)
    {
        try
        {
            var descriptions = await RetryOnceAsync(() => _snmp.WalkAsync(endpoint, credential, "1.3.6.1.2.1.2.2.1.2", 128, TimeSpan.FromSeconds(2), ct), ct);
            var indices = descriptions.Select(v => ParseIndex(v.Oid)).Where(i => i > 0).Take(128).ToArray();
            var result = new List<NetworkInterfaceMetric>();
            foreach (var index in indices)
            {
                var suffix = "." + index;
                var oids = new[] { "1.3.6.1.2.1.31.1.1.1.1", "1.3.6.1.2.1.2.2.1.6", "1.3.6.1.2.1.2.2.1.7", "1.3.6.1.2.1.2.2.1.8", "1.3.6.1.2.1.2.2.1.5", "1.3.6.1.2.1.31.1.1.1.6", "1.3.6.1.2.1.31.1.1.1.10", "1.3.6.1.2.1.2.2.1.14", "1.3.6.1.2.1.2.2.1.20", "1.3.6.1.2.1.2.2.1.13", "1.3.6.1.2.1.2.2.1.19" }.Select(oid => oid + suffix);
                var values = (await RetryOnceAsync(() => _snmp.GetAsync(endpoint, credential, oids, TimeSpan.FromSeconds(2), ct), ct)).ToDictionary(v => v.Oid, v => v.Value);
                var description = descriptions.First(v => ParseIndex(v.Oid) == index).Value;
                var currentIn = ToUnsigned(values.GetValueOrDefault("1.3.6.1.2.1.31.1.1.1.6" + suffix));
                var currentOut = ToUnsigned(values.GetValueOrDefault("1.3.6.1.2.1.31.1.1.1.10" + suffix));
                var observedAt = DateTimeOffset.UtcNow;
                var inPrevious = currentIn is null ? null : await _store.RecordCounterAsync(deviceId.ToString("D"), index, "in", currentIn.Value, uptimeTicks, observedAt, ct);
                var outPrevious = currentOut is null ? null : await _store.RecordCounterAsync(deviceId.ToString("D"), index, "out", currentOut.Value, uptimeTicks, observedAt, ct);
                var rateCalculator = new InterfaceRateCalculator();
                var inBps = inPrevious is null ? null : rateCalculator.Calculate(inPrevious.Octets, currentIn!.Value, (observedAt - inPrevious.ObservedAt).TotalSeconds, inPrevious.Restarted);
                var outBps = outPrevious is null ? null : rateCalculator.Calculate(outPrevious.Octets, currentOut!.Value, (observedAt - outPrevious.ObservedAt).TotalSeconds, outPrevious.Restarted);
                result.Add(new(index,
                    values.GetValueOrDefault("1.3.6.1.2.1.31.1.1.1.1" + suffix) ?? description, description,
                    values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.6" + suffix), ParseInt(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.7" + suffix)),
                    ParseInt(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.8" + suffix)), ParseLong(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.5" + suffix)),
                    ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.31.1.1.1.6" + suffix)), ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.31.1.1.1.10" + suffix)),
                    ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.14" + suffix)), ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.20" + suffix)),
                    ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.13" + suffix)), ToDecimal(values.GetValueOrDefault("1.3.6.1.2.1.2.2.1.19" + suffix)), inBps, outBps));
            }
            return result;
        }
        catch (TimeoutException) { return []; }
    }

    private async Task SendingLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var access = _secrets.Read("access_token");
                var agentId = _secrets.Read("agent_id");
                if (access is not null && agentId is not null)
                {
                    foreach (var batch in await _store.ReadPendingAsync(50, ct))
                    {
                        using var document = JsonDocument.Parse(batch.Payload);
                        try
                        {
                            await _api.SendMetricsAsync(agentId, access, batch.Sequence, document.RootElement, ct);
                            await _store.AcknowledgeAsync(batch.Sequence, ct);
                        }
                        catch (NetworkApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
                        {
                            await RefreshAccessAsync(ct);
                            break;
                        }
                    }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Network outbox send deferred; collection continues: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    private void WritePairingStatus(string code, DateTimeOffset expiresAt, string url, string state)
    {
        var path = Path.Combine(_dataDirectory, "pairing-status.json");
        File.WriteAllText(path, JsonSerializer.Serialize(new { code, expires_at = expiresAt, verification_url = url, state }));
    }

    private static IReadOnlyList<string> GetDetectedNetworks()
    {
        var found = new List<string>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == OperationalStatus.Up))
        foreach (var unicast in nic.GetIPProperties().UnicastAddresses.Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork && a.IPv4Mask is not null))
        {
            var address = unicast.Address.GetAddressBytes();
            var mask = unicast.IPv4Mask!.GetAddressBytes();
            var network = address.Zip(mask, (a, m) => (byte)(a & m)).ToArray();
            var prefix = mask.Sum(b => System.Numerics.BitOperations.PopCount((uint)b));
            if (prefix is >= 1 and <= 30) found.Add($"{string.Join('.', network)}/{prefix}");
        }
        return found.Distinct(StringComparer.Ordinal).Take(64).ToArray();
    }

    private static bool Contains(string cidr, IPAddress candidate)
    {
        var parts = cidr.Split('/');
        var baseAddress = IPAddress.Parse(parts[0]).GetAddressBytes();
        var address = candidate.GetAddressBytes();
        var prefix = int.Parse(parts[1]);
        for (var i = 0; i < 4; i++)
        {
            var bits = Math.Clamp(prefix - i * 8, 0, 8);
            var mask = bits == 0 ? 0 : 0xff << (8 - bits);
            if ((baseAddress[i] & mask) != (address[i] & mask)) return false;
        }
        return true;
    }

    private static int ParseIndex(string oid) => int.TryParse(oid[(oid.LastIndexOf('.') + 1)..], out var index) ? index : 0;
    private static long? ParseUnsigned(string? value) => ulong.TryParse(value, out var number) && number <= long.MaxValue ? (long)number : null;
    private static int? ParseInt(string? value) => int.TryParse(value, out var number) ? number : null;
    private static long? ParseLong(string? value) => long.TryParse(value, out var number) ? number : null;
    private static string? ToDecimal(string? value) => ulong.TryParse(value, out var number) ? number.ToString(System.Globalization.CultureInfo.InvariantCulture) : null;
    private static ulong? ToUnsigned(string? value) => ulong.TryParse(value, out var number) ? number : null;
    private static string Classify(string? description)
    {
        var text = description ?? string.Empty;
        if (text.Contains("router", StringComparison.OrdinalIgnoreCase)) return "Roteador";
        if (text.Contains("switch", StringComparison.OrdinalIgnoreCase)) return "Switch";
        if (text.Contains("printer", StringComparison.OrdinalIgnoreCase) || text.Contains("impress", StringComparison.OrdinalIgnoreCase)) return "Impressora";
        if (text.Contains("firewall", StringComparison.OrdinalIgnoreCase)) return "Firewall";
        if (text.Contains("access point", StringComparison.OrdinalIgnoreCase) || text.Contains("wireless", StringComparison.OrdinalIgnoreCase)) return "Access point";
        return "Outro";
    }

    private static async Task<T> RetryOnceAsync<T>(Func<Task<T>> operation, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try { return await operation(); }
            catch (TimeoutException) when (attempt == 0 && !ct.IsCancellationRequested) { }
        }
    }
}
