using Inner.Monitoring.Edge.Collector.Concurrency;
using Inner.Monitoring.Edge.Collector.Discovery;
using Inner.Monitoring.Edge.Collector.Profiles;
using Inner.Monitoring.Edge.Collector.Snmp;
using Inner.Monitoring.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Polling;

/// <summary>
///     Resultado de uma coleta de métricas.
/// </summary>
public sealed class PollingResult
{
    public required string Host { get; init; }
    public int Port { get; init; } = 161;
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
    public IReadOnlyList<SnmpVariable> Variables { get; init; } = [];
    public Dictionary<string, MetricValue> Metrics { get; init; } = [];
    public TimeSpan Duration { get; init; }
    public DateTimeOffset CollectedAt { get; init; } = DateTimeOffset.UtcNow;
}

/// <summary>
///     Valor de uma métrica coletada.
/// </summary>
public sealed class MetricValue
{
    public required string Oid { get; init; }
    public required string RawValue { get; init; }
    public required SnmpValueType ValueType { get; init; }
    public double? NumericValue { get; init; }
    public string? Unit { get; init; }
}

/// <summary>
///     Interface para executor de polling de dispositivos.
/// </summary>
public interface IPollingExecutor
{
    /// <summary>
    ///     Executa polling de um dispositivo usando seu perfil.
    /// </summary>
    Task<PollingResult> PollAsync(DiscoveredDevice device, CancellationToken ct);

    /// <summary>
    ///     Executa polling em lote de múltiplos dispositivos.
    /// </summary>
    Task<IReadOnlyList<PollingResult>> PollBatchAsync(
        IReadOnlyList<DiscoveredDevice> devices,
        CancellationToken ct);
}

/// <summary>
///     Implementação de executor de polling.
/// </summary>
public sealed class PollingExecutor : IPollingExecutor
{
    private readonly ISnmpClient _snmpClient;
    private readonly IConcurrencyLimiter _concurrency;
    private readonly ILogger<PollingExecutor> _logger;

    public PollingExecutor(
        ISnmpClient snmpClient,
        IConcurrencyLimiter concurrency,
        ILogger<PollingExecutor> logger)
    {
        _snmpClient = snmpClient;
        _concurrency = concurrency;
        _logger = logger;
    }

    public async Task<PollingResult> PollAsync(DiscoveredDevice device, CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var allVariables = new List<SnmpVariable>();
            var metrics = new Dictionary<string, MetricValue>();

            // Execute each query in the profile
            foreach (var query in GetQueriesForProfile(device.Profile))
            {
                if (ct.IsCancellationRequested)
                    break;

                var variables = await ExecuteQueryAsync(device, query, ct);
                allVariables.AddRange(variables);

                // Process variables into metrics
                foreach (var variable in variables)
                {
                    metrics[variable.Oid] = new MetricValue
                    {
                        Oid = variable.Oid,
                        RawValue = variable.Value,
                        ValueType = variable.ValueType,
                        NumericValue = ParseNumericValue(variable),
                        Unit = GetUnitForOid(variable.Oid)
                    };
                }
            }

            sw.Stop();

            _logger.LogDebug(
                "Polled {Host} ({DeviceType}): {MetricCount} metrics in {Elapsed}ms",
                device.Host, device.AssetType, metrics.Count, sw.ElapsedMilliseconds);

            return new PollingResult
            {
                Host = device.Host,
                Port = device.Port,
                Success = true,
                Variables = allVariables,
                Metrics = metrics,
                Duration = sw.Elapsed
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Polling failed for {Host}: {Message}", device.Host, ex.Message);

            return new PollingResult
            {
                Host = device.Host,
                Port = device.Port,
                Success = false,
                ErrorMessage = ex.Message,
                Duration = sw.Elapsed
            };
        }
    }

    public async Task<IReadOnlyList<PollingResult>> PollBatchAsync(
        IReadOnlyList<DiscoveredDevice> devices,
        CancellationToken ct)
    {
        var tasks = devices.Select(d =>
            _concurrency.ExecuteAsync($"poll:{d.Host}", async () => await PollAsync(d, ct), ct));

        var results = await Task.WhenAll(tasks);
        return results;
    }

    private async Task<IReadOnlyList<SnmpVariable>> ExecuteQueryAsync(
        DiscoveredDevice device,
        ProfileQuery query,
        CancellationToken ct)
    {
        return query.Operation?.ToLowerInvariant() switch
        {
            "get" => await ExecuteGetQueryAsync(device, query, ct),
            "walk" => await ExecuteWalkQueryAsync(device, query, ct),
            "bulk_walk" => await ExecuteBulkWalkQueryAsync(device, query, ct),
            _ => []
        };
    }

    private async Task<IReadOnlyList<SnmpVariable>> ExecuteGetQueryAsync(
        DiscoveredDevice device,
        ProfileQuery query,
        CancellationToken ct)
    {
        if (query.Oids == null || query.Oids.Length == 0)
            return [];

        var response = await _snmpClient.GetAsync(
            device.Host,
            device.Port,
            device.Credential,
            query.Oids,
            ct);

        return response.Variables;
    }

    private async Task<IReadOnlyList<SnmpVariable>> ExecuteWalkQueryAsync(
        DiscoveredDevice device,
        ProfileQuery query,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(query.RootOid))
            return [];

        var response = await _snmpClient.WalkAsync(
            device.Host,
            device.Port,
            device.Credential,
            query.RootOid,
            ct);

        return response.Variables;
    }

    private async Task<IReadOnlyList<SnmpVariable>> ExecuteBulkWalkQueryAsync(
        DiscoveredDevice device,
        ProfileQuery query,
        CancellationToken ct)
    {
        if (string.IsNullOrEmpty(query.RootOid))
            return [];

        var response = await _snmpClient.BulkWalkAsync(
            device.Host,
            device.Port,
            device.Credential,
            query.RootOid,
            query.MaxVariables ?? 100,
            ct);

        return response.Variables;
    }

    private static IEnumerable<ProfileQuery> GetQueriesForProfile(CollectionProfile profile)
    {
        // Parse the profile's Metrics JSON to get the queries
        // For now, return default MIB-II queries
        return new[]
        {
            new ProfileQuery
            {
                Operation = "get",
                Oids = ["1.3.6.1.2.1.1.3.0"] // sysUpTime
            },
            new ProfileQuery
            {
                Operation = "bulk_walk",
                RootOid = "1.3.6.1.2.1.2.2", // ifTable
                MaxVariables = 100
            }
        };
    }

    private static double? ParseNumericValue(SnmpVariable variable)
    {
        return variable.ValueType switch
        {
            SnmpValueType.Counter or SnmpValueType.Counter32 or SnmpValueType.Counter64
                or SnmpValueType.Gauge or SnmpValueType.Gauge32 => double.TryParse(variable.Value, out var val) ? val : null,
            SnmpValueType.Timeticks => double.TryParse(variable.Value, out var val) ? val : null,
            _ => null
        };
    }

    private static string? GetUnitForOid(string oid)
    {
        return oid switch
        {
            var o when o.EndsWith(".10") || o.EndsWith(".16") => "bytes", // ifInOctets, ifOutOctets
            var o when o.EndsWith(".14") || o.EndsWith(".20") => "packets", // ifInErrors, ifOutErrors
            var o when o.EndsWith(".13") || o.EndsWith(".19") => "packets", // ifInDiscards, ifOutDiscards
            var o when o.EndsWith(".5") => "bps", // ifSpeed
            var o when o.EndsWith(".3") => "timeticks", // ifType
            var o when o.EndsWith(".7") || o.EndsWith(".8") => "status", // ifAdminStatus, ifOperStatus
            _ => null
        };
    }
}
