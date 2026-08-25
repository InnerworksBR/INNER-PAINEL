using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Edge.Collector.Snmp;

/// <summary>
///     Interface para cliente SNMP usando SharpSnmpLib.
/// </summary>
public interface ISnmpClient
{
    /// <summary>
    ///     Executa operação GET para múltiplos OIDs.
    /// </summary>
    Task<SnmpResponse> GetAsync(
        string host,
        int port,
        SnmpCredential credential,
        string[] oids,
        CancellationToken ct);

    /// <summary>
    ///     Executa operação WALK (GETNEXT iterativo) a partir de um OID raiz.
    /// </summary>
    Task<SnmpWalkResult> WalkAsync(
        string host,
        int port,
        SnmpCredential credential,
        string rootOid,
        CancellationToken ct);

    /// <summary>
    ///     Executa operação BULK WALK (GETBULK) para eficiência em tabelas MIB.
    /// </summary>
    Task<SnmpWalkResult> BulkWalkAsync(
        string host,
        int port,
        SnmpCredential credential,
        string rootOid,
        int maxVariables,
        CancellationToken ct);
}
