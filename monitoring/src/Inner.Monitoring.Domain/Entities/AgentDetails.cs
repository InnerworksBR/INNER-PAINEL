namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Detalhes específicos de um Agent.
/// </summary>
public sealed class AgentDetails
{
    public Guid SourceId { get; private set; }
    public Guid CompanyId { get; private set; }
    public string OsName { get; private set; } = string.Empty;
    public string OsVersion { get; private set; } = string.Empty;
    public string OsArchitecture { get; private set; } = string.Empty;
    public string Hostname { get; private set; } = string.Empty;
    public string? Domain { get; private set; }
    public string? BootId { get; private set; }
    public DateTimeOffset? BootTime { get; private set; }
    public int CpuCount { get; private set; }
    public long TotalMemoryBytes { get; private set; }
    public string? MachineId { get; private set; }
    public string? VirtualizationRole { get; private set; } // host, guest, none
    public string? VirtualizationSystem { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private AgentDetails() { }

    public static AgentDetails Create(
        Guid sourceId,
        Guid companyId,
        string osName,
        string osVersion,
        string osArchitecture,
        string hostname,
        int cpuCount,
        long totalMemoryBytes)
    {
        return new AgentDetails
        {
            SourceId = sourceId,
            CompanyId = companyId,
            OsName = osName,
            OsVersion = osVersion,
            OsArchitecture = osArchitecture,
            Hostname = hostname,
            CpuCount = cpuCount,
            TotalMemoryBytes = totalMemoryBytes,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Update(
        string osName,
        string osVersion,
        string osArchitecture,
        string hostname,
        int cpuCount,
        long totalMemoryBytes)
    {
        OsName = osName;
        OsVersion = osVersion;
        OsArchitecture = osArchitecture;
        Hostname = hostname;
        CpuCount = cpuCount;
        TotalMemoryBytes = totalMemoryBytes;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
