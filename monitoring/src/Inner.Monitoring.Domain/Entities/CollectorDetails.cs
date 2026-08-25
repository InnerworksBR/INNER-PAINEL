namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Detalhes específicos de um Collector.
/// </summary>
public sealed class CollectorDetails
{
    public Guid SourceId { get; private set; }
    public Guid CompanyId { get; private set; }
    public string CollectorType { get; private set; } = "snmp"; // snmp, wmi, etc
    public string OsName { get; private set; } = string.Empty;
    public string OsVersion { get; private set; } = string.Empty;
    public string Hostname { get; private set; } = string.Empty;
    public string NetworkInterface { get; private set; } = string.Empty;
    public string PrimaryIp { get; private set; } = string.Empty;
    public int SnmpTimeoutMs { get; private set; } = 3000;
    public int SnmpRetries { get; private set; } = 3;
    public int MaxConcurrentCollections { get; private set; } = 50;
    public string CapabilitiesJson { get; private set; } = "{}";
    public DateTimeOffset UpdatedAt { get; private set; }

    private CollectorDetails() { }

    public static CollectorDetails Create(
        Guid sourceId,
        Guid companyId,
        string collectorType,
        string osName,
        string osVersion,
        string hostname,
        string primaryIp)
    {
        return new CollectorDetails
        {
            SourceId = sourceId,
            CompanyId = companyId,
            CollectorType = collectorType,
            OsName = osName,
            OsVersion = osVersion,
            Hostname = hostname,
            PrimaryIp = primaryIp,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Update(
        string collectorType,
        string osName,
        string osVersion,
        string hostname,
        string primaryIp)
    {
        CollectorType = collectorType;
        OsName = osName;
        OsVersion = osVersion;
        Hostname = hostname;
        PrimaryIp = primaryIp;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
