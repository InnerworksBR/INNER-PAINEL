namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Heartbeat de uma source.
/// </summary>
public sealed class SourceHeartbeat
{
    public Guid Id { get; private set; }
    public Guid SourceId { get; private set; }
    public Guid CompanyId { get; private set; }
    public DateTimeOffset SourceTime { get; private set; }
    public DateTimeOffset ReceivedAt { get; private set; }
    public string? LastIp { get; private set; }
    public int? ClockSkewSeconds { get; private set; }
    public string CapabilitiesJson { get; private set; } = "{}";
    public string HealthSummaryJson { get; private set; } = "{}";
    public int PendingCommands { get; private set; }
    public long DesiredConfigVersion { get; private set; }
    public DateTimeOffset PartitionDate { get; private set; }

    private SourceHeartbeat() { }

    public static SourceHeartbeat Create(
        Guid sourceId,
        Guid companyId,
        DateTimeOffset sourceTime,
        string? lastIp,
        int? clockSkewSeconds,
        string capabilitiesJson,
        string healthSummaryJson,
        int pendingCommands,
        long desiredConfigVersion)
    {
        return new SourceHeartbeat
        {
            Id = Guid.NewGuid(),
            SourceId = sourceId,
            CompanyId = companyId,
            SourceTime = sourceTime,
            ReceivedAt = DateTimeOffset.UtcNow,
            LastIp = lastIp,
            ClockSkewSeconds = clockSkewSeconds,
            CapabilitiesJson = capabilitiesJson,
            HealthSummaryJson = healthSummaryJson,
            PendingCommands = pendingCommands,
            DesiredConfigVersion = desiredConfigVersion,
            PartitionDate = sourceTime.Date
        };
    }
}
