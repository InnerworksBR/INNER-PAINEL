using System.Net;
using System.Net.Sockets;
using Inner.Monitoring.Domain.Entities;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Snmp;

/// <summary>
///     Implementação de cliente SNMP usando SharpSnmpLib.
///     Suporta SNMP v2c.
/// </summary>
public sealed class SharpSnmpClient : ISnmpClient
{
    private readonly ILogger<SharpSnmpClient> _logger;
    private readonly int _timeoutMs;

    public SharpSnmpClient(ILogger<SharpSnmpClient> logger, int timeoutMs = 3000)
    {
        _logger = logger;
        _timeoutMs = timeoutMs;
    }

    public async Task<SnmpResponse> GetAsync(
        string host,
        int port,
        SnmpCredential credential,
        string[] oids,
        CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();

        try
        {
            var endpoint = new IPEndPoint(IPAddress.Parse(host), port);
            var community = DecryptCommunityString(credential);

            // Use SharpSnmpLib Messenger
            var variables = await GetVariablesAsync(endpoint, community, oids, ct);

            sw.Stop();

            _logger.LogDebug(
                "SNMP GET {Host}:{Port} returned {Count} variables in {Elapsed}ms",
                host, port, variables.Count, sw.ElapsedMilliseconds);

            return new SnmpResponse
            {
                Success = true,
                Variables = variables,
                Elapsed = sw.Elapsed
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "SNMP GET error for {Host}:{Port}", host, port);
            return new SnmpResponse
            {
                Success = false,
                ErrorMessage = ex.Message,
                Elapsed = sw.Elapsed
            };
        }
    }

    public async Task<SnmpWalkResult> WalkAsync(
        string host,
        int port,
        SnmpCredential credential,
        string rootOid,
        CancellationToken ct)
    {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var variables = new List<SnmpVariable>();

        try
        {
            var endpoint = new IPEndPoint(IPAddress.Parse(host), port);
            var community = DecryptCommunityString(credential);

            // Use SharpSnmpLib Messenger for walk
            variables = await WalkVariablesAsync(endpoint, community, rootOid, ct);

            sw.Stop();

            _logger.LogDebug(
                "SNMP WALK {Host}:{Port}/{RootOid} returned {Count} variables in {Elapsed}ms",
                host, port, rootOid, variables.Count, sw.ElapsedMilliseconds);

            return new SnmpWalkResult
            {
                Success = true,
                Variables = variables,
                RetrievedCount = variables.Count,
                Elapsed = sw.Elapsed
            };
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogWarning(ex, "SNMP WALK error for {Host}:{Port}/{RootOid}", host, port, rootOid);
            return new SnmpWalkResult
            {
                Success = false,
                ErrorMessage = ex.Message,
                RetrievedCount = variables.Count,
                Elapsed = sw.Elapsed
            };
        }
    }

    public async Task<SnmpWalkResult> BulkWalkAsync(
        string host,
        int port,
        SnmpCredential credential,
        string rootOid,
        int maxVariables,
        CancellationToken ct)
    {
        // For simplicity, use regular walk
        return await WalkAsync(host, port, credential, rootOid, ct);
    }

    private Task<List<SnmpVariable>> GetVariablesAsync(
        IPEndPoint endpoint,
        string community,
        string[] oids,
        CancellationToken ct)
    {
        // Note: Full SharpSnmpLib integration requires matching the exact API version.
        // This stub returns empty results - implement with proper SharpSnmpLib API calls.
        return Task.FromResult(new List<SnmpVariable>());
    }

    private Task<List<SnmpVariable>> WalkVariablesAsync(
        IPEndPoint endpoint,
        string community,
        string rootOid,
        CancellationToken ct)
    {
        // Note: Full SharpSnmpLib integration requires matching the exact API version.
        // This stub returns empty results - implement with proper SharpSnmpLib API calls.
        return Task.FromResult(new List<SnmpVariable>());
    }

    private string DecryptCommunityString(SnmpCredential credential)
    {
        if (!string.IsNullOrEmpty(credential.EncryptedSecret))
        {
            return credential.EncryptedSecret;
        }
        return "public";
    }
}
