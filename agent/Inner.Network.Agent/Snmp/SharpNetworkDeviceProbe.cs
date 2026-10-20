using System.Globalization;
using System.Net;
using System.Diagnostics;
using Inner.Network.Agent.Metrics;
using Inner.Network.Agent.Persistence;
using Inner.Network.Agent.Transport;
using Inner.Network.Agent.Workers;

namespace Inner.Network.Agent.Snmp;

public sealed class SharpNetworkDeviceProbe(SnmpClient snmp, NetworkAgentStore store,
    Func<IPAddress, int, IPEndPoint>? endpointResolver = null) : INetworkDeviceProbe
{
    private const string SysDescr = "1.3.6.1.2.1.1.1.0";
    private const string SysObjectId = "1.3.6.1.2.1.1.2.0";
    private const string SysUptime = "1.3.6.1.2.1.1.3.0";
    private const string SysName = "1.3.6.1.2.1.1.5.0";
    private const string SysContact = "1.3.6.1.2.1.1.4.0";
    private const string SysLocation = "1.3.6.1.2.1.1.6.0";
    private const string EngineIdOid = "1.3.6.1.6.3.10.2.1.1.0";
    private const string IfDescr = "1.3.6.1.2.1.2.2.1.2";
    private const string IfEntityClass = "1.3.6.1.2.1.47.1.1.1.1.5";

    public async Task<NetworkProbeResult?> ProbeAsync(IPAddress ip, NetworkDefinition network,
        IReadOnlyList<SnmpCredential> credentials, CancellationToken ct = default)
    {
        Exception? lastFailure = null;
        foreach (var credential in credentials.Take(4))
        {
            try
            {
                var endpoint = endpointResolver?.Invoke(ip, network.SnmpPort) ?? new IPEndPoint(ip, Math.Clamp(network.SnmpPort, 1, 65535));
                var started = Stopwatch.GetTimestamp();
                var values = await RetryOnceAsync(() => snmp.GetAsync(endpoint, credential,
                    [SysDescr, SysObjectId, SysUptime, SysName, SysContact, SysLocation, EngineIdOid], TimeSpan.FromSeconds(2), ct), ct);
                var system = values.ToDictionary(v => v.Oid, v => v.Value, StringComparer.Ordinal);
                if (values.Count == 0) return null;
                var description = Value(system, SysDescr);
                var engineId = Value(system, EngineIdOid);
                var uptimeTicks = Unsigned(Value(system, SysUptime)) ?? 0;
                var partial = false;
                var entity = await TryReadEntityAsync(endpoint, credential, ct);
                partial |= entity.Failed;
                var observed = DateTimeOffset.UtcNow;
                var deviceUid = await store.ResolveAndUpsertTargetAsync(network.Id, network.NetworkScopeId ?? network.Id,
                    ip.ToString(), engineId, entity.SerialNumber, observed, TimeSpan.FromMinutes(15), ct);
                var interfaces = await TryReadInterfacesAsync(endpoint, credential, deviceUid, uptimeTicks, ct);
                partial |= interfaces.Failed;
                var result = new NetworkDeviceMetric(network.Id, deviceUid.ToString("D"), ip.ToString(),
                    Value(system, SysName) ?? ip.ToString(), Classify(description), observed,
                    partial ? "partial" : "success", Value(system, SysObjectId), description,
                    uptimeTicks / 100 <= long.MaxValue ? (long)(uptimeTicks / 100) : null, Stopwatch.GetElapsedTime(started).TotalMilliseconds,
                    entity.Manufacturer, entity.Model, entity.SerialNumber, entity.FirmwareVersion,
                    Value(system, SysLocation), engineId, interfaces.Interfaces, Value(system, SysContact), !interfaces.Failed);
                return new(result, engineId, entity.SerialNumber, deviceUid);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex) when (ex is TimeoutException or SnmpProtocolException or SnmpAuthenticationException or ArgumentException or System.Net.Sockets.SocketException)
            {
                lastFailure = ex;
            }
        }
        if (lastFailure is not null) System.Runtime.ExceptionServices.ExceptionDispatchInfo.Capture(lastFailure).Throw();
        return null;
    }

    private async Task<(bool Failed, string? Manufacturer, string? Model, string? SerialNumber, string? FirmwareVersion)> TryReadEntityAsync(
        IPEndPoint endpoint, SnmpCredential credential, CancellationToken ct)
    {
        try
        {
            var classes = await RetryOnceAsync(() => snmp.WalkAsync(endpoint, credential, IfEntityClass, 64, TimeSpan.FromSeconds(2), ct), ct);
            var chassis = classes.FirstOrDefault(row => row.Value == "3") ?? classes.FirstOrDefault();
            if (chassis is null) return (false, null, null, null, null);
            var index = chassis.Oid[(IfEntityClass.Length + 1)..];
            var oids = new[]
            {
                "1.3.6.1.2.1.47.1.1.1.1.12." + index,
                "1.3.6.1.2.1.47.1.1.1.1.13." + index,
                "1.3.6.1.2.1.47.1.1.1.1.11." + index,
                "1.3.6.1.2.1.47.1.1.1.1.9." + index
            };
            var values = (await RetryOnceAsync(() => snmp.GetAsync(endpoint, credential, oids, TimeSpan.FromSeconds(2), ct), ct))
                .ToDictionary(v => v.Oid, v => v.Value, StringComparer.Ordinal);
            return (false, Optional(values.GetValueOrDefault(oids[0])), Optional(values.GetValueOrDefault(oids[1])),
                Optional(values.GetValueOrDefault(oids[2])), Optional(values.GetValueOrDefault(oids[3])));
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) when (IsOptionalFailure(ex)) { return (true, null, null, null, null); }
    }

    private async Task<(bool Failed, IReadOnlyList<NetworkInterfaceMetric> Interfaces)> TryReadInterfacesAsync(
        IPEndPoint endpoint, SnmpCredential credential, Guid deviceUid, ulong uptimeTicks, CancellationToken ct)
    {
        IReadOnlyList<SnmpValue> descriptions;
        try { descriptions = await RetryOnceAsync(() => snmp.WalkAsync(endpoint, credential, IfDescr, 128, TimeSpan.FromSeconds(2), ct), ct); }
        catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
        catch (Exception ex) when (IsOptionalFailure(ex)) { return (true, []); }

        var interfaces = new List<NetworkInterfaceMetric>();
        var failed = false;
        foreach (var description in descriptions.Take(128))
        {
            var index = ParseIndex(description.Oid);
            if (index <= 0) continue;
            var suffix = "." + index;
            var oids = new[]
            {
                "1.3.6.1.2.1.31.1.1.1.1" + suffix, // ifName
                "1.3.6.1.2.1.2.2.1.6" + suffix, // ifPhysAddress
                "1.3.6.1.2.1.2.2.1.3" + suffix, // ifType
                "1.3.6.1.2.1.2.2.1.7" + suffix, // ifAdminStatus
                "1.3.6.1.2.1.2.2.1.8" + suffix, // ifOperStatus
                "1.3.6.1.2.1.2.2.1.5" + suffix, // ifSpeed
                "1.3.6.1.2.1.31.1.1.1.15" + suffix, // ifHighSpeed
                "1.3.6.1.2.1.31.1.1.1.6" + suffix, // ifHCInOctets
                "1.3.6.1.2.1.31.1.1.1.10" + suffix, // ifHCOutOctets
                "1.3.6.1.2.1.2.2.1.10" + suffix, // ifInOctets fallback
                "1.3.6.1.2.1.2.2.1.16" + suffix, // ifOutOctets fallback
                "1.3.6.1.2.1.2.2.1.14" + suffix, // ifInErrors
                "1.3.6.1.2.1.2.2.1.20" + suffix, // ifOutErrors
                "1.3.6.1.2.1.2.2.1.13" + suffix, // ifInDiscards
                "1.3.6.1.2.1.2.2.1.19" + suffix, // ifOutDiscards
                "1.3.6.1.2.1.31.1.1.1.19" + suffix // ifCounterDiscontinuityTime
            };
            try
            {
                var values = (await RetryOnceAsync(() => snmp.GetAsync(endpoint, credential, oids, TimeSpan.FromSeconds(2), ct), ct))
                    .ToDictionary(v => v.Oid, v => v.Value, StringComparer.Ordinal);
                var inOctets = Unsigned(Value(values, oids[7])) ?? Unsigned(Value(values, oids[9]));
                var outOctets = Unsigned(Value(values, oids[8])) ?? Unsigned(Value(values, oids[10]));
                var discontinuity = Unsigned(Value(values, oids[15])) ?? 0;
                var observed = DateTimeOffset.UtcNow;
                var inPrevious = inOctets is null ? null : await store.RecordCounterAsync(deviceUid.ToString("D"), index, "in", inOctets.Value, uptimeTicks, observed, discontinuity, ct);
                var outPrevious = outOctets is null ? null : await store.RecordCounterAsync(deviceUid.ToString("D"), index, "out", outOctets.Value, uptimeTicks, observed, discontinuity, ct);
                var rates = new InterfaceRateCalculator();
                var inBps = inPrevious is null || inOctets is null ? null : rates.Calculate(inPrevious.Octets, inOctets.Value,
                    (observed - inPrevious.ObservedAt).TotalSeconds, inPrevious.Restarted);
                var outBps = outPrevious is null || outOctets is null ? null : rates.Calculate(outPrevious.Octets, outOctets.Value,
                    (observed - outPrevious.ObservedAt).TotalSeconds, outPrevious.Restarted);
                var highSpeed = Unsigned(Value(values, oids[6]));
                var speed = highSpeed is not null ? (long)Math.Min(long.MaxValue, highSpeed.Value * 1_000_000UL) : Long(Value(values, oids[5]));
                interfaces.Add(new(index, Value(values, oids[0]) ?? description.Value, description.Value,
                    Value(values, oids[1]), Int(Value(values, oids[3])), Int(Value(values, oids[4])), speed,
                    Decimal(inOctets), Decimal(outOctets), Decimal(Value(values, oids[11])), Decimal(Value(values, oids[12])),
                    Decimal(Value(values, oids[13])), Decimal(Value(values, oids[14])), inBps, outBps, Int(Value(values, oids[2]))));
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { throw; }
            catch (Exception ex) when (IsOptionalFailure(ex)) { failed = true; }
        }
        return (failed, interfaces);
    }

    private static bool IsOptionalFailure(Exception ex) => ex is TimeoutException or SnmpProtocolException or SnmpAuthenticationException or ArgumentException or System.Net.Sockets.SocketException;

    private static async Task<T> RetryOnceAsync<T>(Func<Task<T>> operation, CancellationToken ct)
    {
        for (var attempt = 0; ; attempt++)
        {
            try { return await operation(); }
            catch (TimeoutException) when (attempt == 0 && !ct.IsCancellationRequested) { }
        }
    }

    private static string? Value(IReadOnlyDictionary<string, string> values, string oid) => Optional(values.GetValueOrDefault(oid));
    private static string? Optional(string? value) => string.IsNullOrWhiteSpace(value) || value.Equals("NoSuchObject", StringComparison.OrdinalIgnoreCase) ||
        value.Equals("NoSuchInstance", StringComparison.OrdinalIgnoreCase) || value.Equals("EndOfMibView", StringComparison.OrdinalIgnoreCase) ? null : value;
    private static ulong? Unsigned(string? value) => ulong.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var result) ? result : null;
    private static long? Long(string? value) => long.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var result) ? result : null;
    private static int? Int(string? value) => int.TryParse(value, NumberStyles.None, CultureInfo.InvariantCulture, out var result) ? result : null;
    private static string? Decimal(ulong? value) => value?.ToString(CultureInfo.InvariantCulture);
    private static string? Decimal(string? value) => Unsigned(value)?.ToString(CultureInfo.InvariantCulture);
    private static int ParseIndex(string oid) => int.TryParse(oid[(oid.LastIndexOf('.') + 1)..], out var index) ? index : 0;

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
}
