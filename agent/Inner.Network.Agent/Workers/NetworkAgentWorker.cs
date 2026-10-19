using System.Diagnostics;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
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
    string? Location = null, string? EngineId = null, IReadOnlyList<NetworkInterfaceMetric>? Interfaces = null,
    string? SysContact = null);
public sealed record NetworkInterfaceMetric(
    int IfIndex, string Name, string? Description = null, string? MacAddress = null,
    int? AdminStatus = null, int? OperStatus = null, long? SpeedBps = null,
    string? InOctets = null, string? OutOctets = null, string? InErrors = null,
    string? OutErrors = null, string? InDiscards = null, string? OutDiscards = null,
    double? InBps = null, double? OutBps = null, int? IfType = null);

public sealed class NetworkAgentWorker(ILogger<NetworkAgentWorker> logger, IConfiguration configuration) : BackgroundService
{
    private const string Version = "1.1.0";
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };
    private readonly string _dataDirectory = configuration["Agent:DataDirectory"] ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "InnerWorks", "NetworkAgent");
    private readonly Stopwatch _uptime = Stopwatch.StartNew();
    private NetworkAgentStore _store = null!;
    private NetworkSecretStore _secrets = null!;
    private NetworkApiClient _api = null!;
    private NetworkOutboxSender _sender = null!;
    private NetworkTokenRefreshCoordinator _refresh = null!;
    private NetworkAgentAuthorizationLifecycle _authorization = null!;
    private NetworkCollectionCoordinator _collector = null!;
    private NetworkConfigurationCache _configurationCache = null!;
    private volatile string _lastCollectionResult = "success";
    private volatile string? _lastErrorCode;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        Directory.CreateDirectory(_dataDirectory);
        _store = new NetworkAgentStore(Path.Combine(_dataDirectory, "network-agent.db"));
        await _store.InitializeAsync(stoppingToken);
        _secrets = new NetworkSecretStore(Path.Combine(_dataDirectory, "secrets"));
        _authorization = new NetworkAgentAuthorizationLifecycle(_secrets);
        if (_authorization.AuthorizationLost)
            WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "relink_required");
        _configurationCache = new NetworkConfigurationCache(_secrets);
        _api = new NetworkApiClient(new HttpClient { Timeout = TimeSpan.FromSeconds(15) }, configuration["Agent:ApiBaseUrl"] ?? "https://innerworks-painelbackend.zvzr4n.easypanel.host");
        _sender = new NetworkOutboxSender(_store, _api);
        _refresh = new NetworkTokenRefreshCoordinator(_api, _secrets);
        var snmp = new SnmpClient();
        _collector = new NetworkCollectionCoordinator(_store, new SharpNetworkDeviceProbe(snmp, _store));

        var provisioning = ProvisionAndConfigureAsync(stoppingToken);
        var collection = CollectionLoopAsync(stoppingToken);
        var discovery = DiscoveryLoopAsync(stoppingToken);
        var sending = SendingLoopAsync(stoppingToken);
        var heartbeat = new NetworkHeartbeatLoop(PublishHeartbeatAsync, logger).RunAsync(stoppingToken);
        await Task.WhenAll(provisioning, collection, discovery, sending, heartbeat);
    }

    private async Task ProvisionAndConfigureAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var agentId = _secrets.Read("agent_id");
                if (agentId is null)
                    await PairUntilApprovedAsync(ct);
                else if (_secrets.Read("access_token") is null)
                    await RefreshAccessAsync(null, ct);

                var access = _secrets.Read("access_token");
                if (_secrets.Read("agent_id") is not null && access is not null)
                {
                    try
                    {
                        var current = await _api.GetConfigurationAsync(access, ct);
                        await PersistConfigurationAsync(current, ct);
                    }
                    catch (NetworkApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
                    {
                        if (ex.ConfirmsAgentRevocation) MarkRevoked();
                        else await RefreshAccessAsync(access, ct);
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
            var request = new PairingRequest(await _store.GetOrCreateMachineIdAsync(ct), Environment.MachineName,
                Version, Environment.OSVersion.VersionString, GetDetectedNetworks());
            var pairing = await _api.CreatePairingAsync(request, ct);
            pairingId = pairing.PairingId;
            deviceSecret = pairing.DeviceSecret;
            _secrets.Save("pairing_id", pairingId);
            _secrets.Save("device_secret", deviceSecret);
            WritePairingStatus(pairing.UserCode, pairing.ExpiresAt, pairing.VerificationUrl, "pending");
            logger.LogInformation("Pairing session {PairingId} created; valid until {ExpiresAt:u}. Open {VerificationUrl} to claim this agent.", pairingId, pairing.ExpiresAt, pairing.VerificationUrl);
        }

        while (!ct.IsCancellationRequested && _secrets.Read("agent_id") is null)
        {
            var status = await _api.GetPairingStatusAsync(pairingId, deviceSecret, ct);
            if (status.State is "approved" or "completed")
            {
                var credentials = await new PairingCoordinator(_api, _secrets).CompleteAsync(pairingId, deviceSecret, ct);
                _secrets.Save("agent_id", credentials.AgentId);
                _secrets.Save("company_id", credentials.CompanyId);
                _authorization.ClearAfterSuccessfulRelink();
                _secrets.Delete("pairing_id");
                _secrets.Delete("device_secret");
                WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "completed");
                return;
            }
            if (status.State == "expired")
            {
                _secrets.Delete("pairing_id");
                _secrets.Delete("device_secret");
                _secrets.Delete("pairing_initial_refresh_token");
                _secrets.Delete("pairing_session");
                _secrets.Delete("refresh_token");
                WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "expired");
                return;
            }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    private async Task RefreshAccessAsync(string? rejectedToken, CancellationToken ct)
    {
        try
        {
            var credentials = await _authorization.RefreshAfterAccessRejectedAsync(_refresh, rejectedToken, ct);
            if (credentials is not null)
            {
                if (!string.IsNullOrWhiteSpace(credentials.AgentId)) _secrets.Save("agent_id", credentials.AgentId);
                if (!string.IsNullOrWhiteSpace(credentials.CompanyId)) _secrets.Save("company_id", credentials.CompanyId);
            }
            else if (_authorization.AuthorizationLost)
            {
                logger.LogError("Network agent authorization was rejected during refresh; a new pairing is required and cached network collection has stopped.");
                WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "relink_required");
            }
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) { logger.LogWarning("Access token refresh deferred: {ErrorType}", ex.GetType().Name); }
    }

    private async Task PersistConfigurationAsync(NetworkAgentConfiguration config, CancellationToken ct)
    {
        _configurationCache.Replace(config);
        await _store.SaveConfigurationAsync(JsonSerializer.Serialize(new { config.Version, config.Enabled }, JsonOptions), ct);
    }

    private async Task CollectionLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var delaySeconds = 60;
            try
            {
                var config = ReadCachedConfiguration();
                if (_authorization.CanUseCachedQueries && config is { Enabled: true })
                {
                    delaySeconds = Math.Clamp(config.CollectionIntervalSeconds, 30, 3600);
                    var result = await _collector.PollKnownAsync(config, DateTimeOffset.UtcNow, ct);
                    _lastCollectionResult = result.Devices.Any(device => device.Result is "timeout" or "auth_error" or "protocol_error") ? "partial" : "success";
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { _lastCollectionResult = "failed"; logger.LogWarning("Network collection cycle failed; cached configuration remains active: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(delaySeconds), ct);
        }
    }

    private async Task DiscoveryLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var config = ReadCachedConfiguration();
                if (_authorization.CanUseCachedQueries && config is { Enabled: true }) await _collector.DiscoverAsync(config, DateTimeOffset.UtcNow, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogWarning("Network discovery cycle failed; known-device polling continues: {ErrorType}", ex.GetType().Name); }
            await Task.Delay(TimeSpan.FromSeconds(30), ct);
        }
    }

    private async Task SendingLoopAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var access = _secrets.Read("access_token");
                var agentId = _secrets.Read("agent_id");
                if (_authorization.CanUseCachedQueries && access is not null && agentId is not null)
                {
                    foreach (var batch in await _store.ReadPendingAsync(50, ct))
                    {
                        try
                        {
                            var accepted = await _sender.SendOneAsync(agentId, access, batch, ct);
                            if (!accepted)
                            {
                                _lastErrorCode = "metrics_rejected_400_413";
                                logger.LogError("Network metrics batch was permanently rejected by backend validation: sequence {Sequence}.", batch.Sequence);
                            }
                            else _lastErrorCode = null;
                        }
                        catch (NetworkApiException ex) when (ex.ConfirmsAgentRevocation) { MarkRevoked(); break; }
                        catch (NetworkApiException ex) when (ex.StatusCode == HttpStatusCode.Unauthorized)
                        {
                            await RefreshAccessAsync(access, ct);
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

    private async Task PublishHeartbeatAsync(CancellationToken ct)
    {
        var access = _secrets.Read("access_token");
        if (!_authorization.CanUseCachedQueries || access is null || _secrets.Read("agent_id") is null) return;
        var outbox = await _store.GetOutboxStatusAsync(ct);
        var heartbeat = new NetworkHeartbeatPayload(DateTimeOffset.UtcNow, (long)_uptime.Elapsed.TotalSeconds, Version,
            outbox.CreatedSequence, outbox.AcknowledgedSequence, outbox.PendingCount, outbox.PendingBytes,
            _lastCollectionResult, _lastErrorCode, await _store.GetDiscoveryStateAsync(ct),
            await _store.GetLastDiscoveredDeviceCountAsync(ct), await _store.GetLastDiscoveryAtAsync(ct));
        try { await _api.SendHeartbeatAsync(access, heartbeat, ct); }
        catch (NetworkApiException ex) when (ex.ConfirmsAgentRevocation) { MarkRevoked(); throw; }
    }

    private NetworkAgentConfiguration? ReadCachedConfiguration()
    {
        if (!_authorization.CanUseCachedQueries) return null;
        var json = _secrets.Read("configuration_cache");
        if (json is null) return null;
        var cached = JsonSerializer.Deserialize<NetworkAgentConfiguration>(json, JsonOptions);
        if (cached is null) return null;
        NetworkConfigurationValidator.Validate(cached);
        return cached;
    }

    private void MarkRevoked()
    {
        _authorization.MarkAgentRevoked();
        logger.LogError("Network agent enrollment was revoked by the server; a new pairing is required and cached network collection has stopped.");
        try { WritePairingStatus(string.Empty, DateTimeOffset.UtcNow, string.Empty, "relink_required"); }
        catch (Exception ex) { logger.LogWarning("Could not persist relink status: {ErrorType}", ex.GetType().Name); }
    }

    private void WritePairingStatus(string code, DateTimeOffset expiresAt, string url, string state)
    {
        var path = Path.Combine(_dataDirectory, "pairing-status.json");
        File.WriteAllText(path, JsonSerializer.Serialize(new { code, expires_at = expiresAt, verification_url = url, state }));
    }

    private static IReadOnlyList<string> GetDetectedNetworks()
    {
        var networks = new List<string>();
        foreach (var nic in System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces().Where(n => n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up))
        foreach (var address in nic.GetIPProperties().UnicastAddresses.Where(a => a.Address.AddressFamily == System.Net.Sockets.AddressFamily.InterNetwork && a.IPv4Mask is not null))
        {
            var ip = address.Address.GetAddressBytes();
            var mask = address.IPv4Mask!.GetAddressBytes();
            var network = ip.Zip(mask, (octet, maskOctet) => (byte)(octet & maskOctet)).ToArray();
            var prefix = mask.Sum(octet => System.Numerics.BitOperations.PopCount((uint)octet));
            if (prefix is >= 1 and <= 30) networks.Add($"{string.Join('.', network)}/{prefix}");
        }
        return networks.Distinct(StringComparer.Ordinal).Take(64).ToArray();
    }
}
