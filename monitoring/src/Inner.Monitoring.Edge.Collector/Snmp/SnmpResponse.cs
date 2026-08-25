namespace Inner.Monitoring.Edge.Collector.Snmp;

/// <summary>
///     Resposta de uma operação SNMP GET.
/// </summary>
public sealed class SnmpResponse
{
    public bool Success { get; init; }
    public IReadOnlyList<SnmpVariable> Variables { get; init; } = [];
    public string? ErrorMessage { get; init; }
    public TimeSpan Elapsed { get; init; }
}

/// <summary>
///     Resultado de uma operação SNMP WALK.
/// </summary>
public sealed class SnmpWalkResult
{
    public bool Success { get; init; }
    public IReadOnlyList<SnmpVariable> Variables { get; init; } = [];
    public string? ErrorMessage { get; init; }
    public int RetrievedCount { get; init; }
    public TimeSpan Elapsed { get; init; }
}

/// <summary>
///     Variável SNMP com OID e valor.
/// </summary>
public sealed class SnmpVariable
{
    public required string Oid { get; init; }
    public required string Value { get; init; }
    public required SnmpValueType ValueType { get; init; }
    public string? DisplayName { get; init; }
}

/// <summary>
///     Tipo de valor SNMP.
/// </summary>
public enum SnmpValueType
{
    Unknown,
    Integer,
    String,
    Oid,
    Counter,
    Counter32,
    Counter64,
    Gauge,
    Gauge32,
    Timeticks,
    IpAddress,
    Opaque,
    Null
}
