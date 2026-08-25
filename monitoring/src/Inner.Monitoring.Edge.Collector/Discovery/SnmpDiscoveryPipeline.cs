using System.Text.Json;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Edge.Collector.Classification;
using Inner.Monitoring.Edge.Collector.Concurrency;
using Inner.Monitoring.Edge.Collector.Profiles;
using Inner.Monitoring.Edge.Collector.Snmp;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Discovery;

/// <summary>
///     Resultado de uma operação de identity probe.
/// </summary>
public sealed class IdentityProbeResult
{
    public required string Host { get; init; }
    public int Port { get; init; } = 161;
    public required SnmpCredential Credential { get; init; }
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }

    // MIB-II System Group
    public string? SysDescr { get; init; }
    public string? SysObjectId { get; init; }
    public string? SysUpTime { get; init; }
    public string? SysName { get; init; }
    public string? SysLocation { get; init; }
    public string? SysContact { get; init; }
    public int? SysServices { get; init; }

    public TimeSpan ProbeDuration { get; init; }
}

/// <summary>
///     Resultado de classificação de dispositivo.
/// </summary>
public sealed class DiscoveredDevice
{
    public required string Host { get; init; }
    public int Port { get; init; } = 161;
    public required SnmpCredential Credential { get; init; }
    public required string AssetType { get; init; }
    public required string DisplayName { get; init; }
    public required string SysObjectId { get; init; }
    public string? SysDescr { get; init; }
    public string? SysName { get; init; }
    public string? SysLocation { get; init; }
    public string? Manufacturer { get; init; }
    public string? Model { get; init; }
    public string? SerialNumber { get; init; }
    public string? PrimaryIp { get; init; }
    public string? PrimaryMac { get; init; }
    public required CollectionProfile Profile { get; init; }
    public Guid? ExistingAssetId { get; init; }
    public DateTimeOffset DiscoveredAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
///     Interface para pipeline de descoberta SNMP.
/// </summary>
public interface IDiscoveryPipeline
{
    /// <summary>
    ///     Executa descoberta em um range de rede.
    /// </summary>
    Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        NetworkRange range,
        IReadOnlyList<SnmpCredential> credentials,
        CancellationToken ct);

    /// <summary>
    ///     Executa identity probe em um host específico.
    /// </summary>
    Task<IdentityProbeResult> ProbeHostAsync(
        string host,
        int port,
        SnmpCredential credential,
        CancellationToken ct);
}

/// <summary>
///     Pipeline de descoberta SNMP completo.
/// </summary>
public sealed class SnmpDiscoveryPipeline : IDiscoveryPipeline
{
    private readonly ISnmpClient _snmpClient;
    private readonly IDeviceClassifier _classifier;
    private readonly IProfileResolver _profileResolver;
    private readonly IRangePlanner _rangePlanner;
    private readonly IConcurrencyLimiter _concurrency;
    private readonly ILogger<SnmpDiscoveryPipeline> _logger;

    public SnmpDiscoveryPipeline(
        ISnmpClient snmpClient,
        IDeviceClassifier classifier,
        IProfileResolver profileResolver,
        IRangePlanner rangePlanner,
        IConcurrencyLimiter concurrency,
        ILogger<SnmpDiscoveryPipeline> logger)
    {
        _snmpClient = snmpClient;
        _classifier = classifier;
        _profileResolver = profileResolver;
        _rangePlanner = rangePlanner;
        _concurrency = concurrency;
        _logger = logger;
    }

    public async Task<IReadOnlyList<DiscoveredDevice>> DiscoverAsync(
        NetworkRange range,
        IReadOnlyList<SnmpCredential> credentials,
        CancellationToken ct)
    {
        var discoveredDevices = new List<DiscoveredDevice>();
        var cidrRange = CidrRange.Parse(range.Cidr);

        _logger.LogInformation(
            "Starting discovery on range {Name} ({Cidr}) with {CredentialCount} credentials",
            range.Name, range.Cidr, credentials.Count);

        // Get exclusions (would be loaded from config in real implementation)
        var exclusions = new List<CidrRange>();

        // Enumerate candidates - streaming
        var candidates = _rangePlanner.EnumerateCandidates(cidrRange, exclusions).ToList();

        _logger.LogInformation(
            "Range {Cidr} has {CandidateCount} candidates to probe",
            range.Cidr, candidates.Count);

        // Probe each candidate with each credential
        var tasks = new List<Task<DiscoveredDevice?>>();

        foreach (var candidate in candidates)
        {
            if (ct.IsCancellationRequested)
                break;

            foreach (var credential in credentials)
            {
                if (ct.IsCancellationRequested)
                    break;

                var host = candidate.ToString();

                // Use concurrency limiter for identity probes
                var task = _concurrency.ExecuteAsync($"probe:{host}:{credential.Id}", async () =>
                {
                    var probeResult = await ProbeHostAsync(host, 161, credential, ct);

                    if (!probeResult.Success)
                    {
                        return null;
                    }

                    // Classify the device
                    var classification = _classifier.Classify(probeResult);

                    if (classification.Confidence == ClassificationConfidence.Low)
                    {
                        return null;
                    }

                    // Resolve profile
                    var profile = await _profileResolver.ResolveProfileAsync(
                        classification.DeviceType, ct);

                    if (profile == null)
                    {
                        _logger.LogWarning(
                            "No profile found for device type {Type} on {Host}",
                            classification.DeviceType, host);
                        return null;
                    }

                    // Extract manufacturer/model from sysDescr or sysObjectId
                    var (manufacturer, model, serialNumber) = ExtractDeviceInfo(
                        probeResult.SysDescr, probeResult.SysObjectId);

                    return new DiscoveredDevice
                    {
                        Host = host,
                        Port = 161,
                        Credential = credential,
                        AssetType = classification.DeviceType,
                        DisplayName = probeResult.SysName ?? host,
                        SysObjectId = probeResult.SysObjectId ?? string.Empty,
                        SysDescr = probeResult.SysDescr,
                        SysName = probeResult.SysName,
                        SysLocation = probeResult.SysLocation,
                        Manufacturer = manufacturer,
                        Model = model,
                        SerialNumber = serialNumber,
                        PrimaryIp = host,
                        Profile = profile,
                        DiscoveredAt = DateTimeOffset.UtcNow
                    };
                }, ct);

                tasks.Add(task);
            }
        }

        // Wait for all probes with progress logging
        var completedCount = 0;
        var totalTasks = tasks.Count;

        while (tasks.Count > 0)
        {
            if (ct.IsCancellationRequested)
                break;

            var completedTask = await Task.WhenAny(tasks);
            tasks.Remove(completedTask);

            try
            {
                var result = await completedTask;
                if (result != null)
                {
                    lock (discoveredDevices)
                    {
                        discoveredDevices.Add(result);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in discovery task");
            }

            completedCount++;
            if (completedCount % 100 == 0)
            {
                _logger.LogInformation(
                    "Discovery progress: {Completed}/{Total} probes completed, {Found} devices found",
                    completedCount, totalTasks, discoveredDevices.Count);
            }
        }

        _logger.LogInformation(
            "Discovery completed for {Range}: found {DeviceCount} devices",
            range.Name, discoveredDevices.Count);

        return discoveredDevices;
    }

    public async Task<IdentityProbeResult> ProbeHostAsync(
        string host,
        int port,
        SnmpCredential credential,
        CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            // Execute identity probe using MIB-II system group
            var response = await _snmpClient.GetAsync(
                host,
                port,
                credential,
                Mib2Oids.System.IdentityProbe,
                ct);

            sw.Stop();

            if (!response.Success)
            {
                return new IdentityProbeResult
                {
                    Host = host,
                    Port = port,
                    Credential = credential,
                    Success = false,
                    ErrorMessage = response.ErrorMessage,
                    ProbeDuration = sw.Elapsed
                };
            }

            // Parse response
            string? sysDescr = null;
            string? sysObjectId = null;
            string? sysUpTime = null;
            string? sysName = null;
            string? sysLocation = null;
            string? sysContact = null;
            int? sysServices = null;

            foreach (var variable in response.Variables)
            {
                switch (variable.Oid)
                {
                    case Mib2Oids.System.Descr:
                        sysDescr = variable.Value;
                        break;
                    case Mib2Oids.System.ObjectId:
                        sysObjectId = variable.Value;
                        break;
                    case Mib2Oids.System.UpTime:
                        sysUpTime = variable.Value;
                        break;
                    case Mib2Oids.System.Name:
                        sysName = variable.Value;
                        break;
                    case Mib2Oids.System.Location:
                        sysLocation = variable.Value;
                        break;
                    case Mib2Oids.System.Contact:
                        sysContact = variable.Value;
                        break;
                    case Mib2Oids.System.Services:
                        if (int.TryParse(variable.Value, out var services))
                            sysServices = services;
                        break;
                }
            }

            return new IdentityProbeResult
            {
                Host = host,
                Port = port,
                Credential = credential,
                Success = true,
                ProbeDuration = sw.Elapsed,
                SysDescr = sysDescr,
                SysObjectId = sysObjectId,
                SysUpTime = sysUpTime,
                SysName = sysName,
                SysLocation = sysLocation,
                SysContact = sysContact,
                SysServices = sysServices
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogDebug(ex, "Probe exception for {Host}", host);
            return new IdentityProbeResult
            {
                Host = host,
                Port = port,
                Credential = credential,
                Success = false,
                ErrorMessage = ex.Message,
                ProbeDuration = sw.Elapsed
            };
        }
    }

    private static (string? Manufacturer, string? Model, string? Serial) ExtractDeviceInfo(
        string? sysDescr, string? sysObjectId)
    {
        string? manufacturer = null;
        string? model = null;

        // Extract from sysDescr patterns
        if (!string.IsNullOrEmpty(sysDescr))
        {
            var descr = sysDescr.ToUpperInvariant();

            // Common manufacturer patterns
            if (descr.Contains("CISCO")) manufacturer = "Cisco";
            else if (descr.Contains("JUNIPER")) manufacturer = "Juniper";
            else if (descr.Contains("HPE") || (descr.Contains("HP") && descr.Contains("PROCURVE"))) manufacturer = "HP";
            else if (descr.Contains("ARUBA")) manufacturer = "Aruba";
            else if (descr.Contains("UBIQUITI")) manufacturer = "Ubiquiti";
            else if (descr.Contains("MIKROTIK")) manufacturer = "MikroTik";
            else if (descr.Contains("DELL")) manufacturer = "Dell";
            else if (descr.Contains("ARISTA")) manufacturer = "Arista";
            else if (descr.Contains("HUAWEI")) manufacturer = "Huawei";
            else if (descr.Contains("TP-LINK")) manufacturer = "TP-Link";
            else if (descr.Contains("ZYXEL")) manufacturer = "Zyxel";

            // Extract model from sysDescr
            var modelPatterns = new[] { "Model:", "Version:", "Model Number:", "Product:" };
            foreach (var pattern in modelPatterns)
            {
                var idx = descr.IndexOf(pattern, StringComparison.Ordinal);
                if (idx >= 0)
                {
                    var rest = sysDescr[(idx + pattern.Length)..].Trim();
                    var end = rest.IndexOfAny([' ', ',', ';', '\n', '\r']);
                    if (end > 0)
                        model = rest[..end].Trim();
                    else if (rest.Length > 0)
                        model = rest.Trim();
                    break;
                }
            }
        }

        return (manufacturer, model, null);
    }
}
