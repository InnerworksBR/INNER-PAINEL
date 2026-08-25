using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Representa uma source autenticada (agent ou collector).
/// </summary>
public sealed class Source
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SiteId { get; private set; }
    public SourceType SourceType { get; private set; }
    public Guid InstallationId { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public SourceStatus Status { get; private set; } = SourceStatus.Pending;
    public string Platform { get; private set; } = string.Empty;
    public string Architecture { get; private set; } = string.Empty;
    public string CurrentVersion { get; private set; } = string.Empty;
    public string? DesiredVersion { get; private set; }
    public string? MinimumVersion { get; private set; }
    public long ConfigVersion { get; private set; } = 1;
    public int HeartbeatIntervalSeconds { get; private set; } = 60;
    public DateTimeOffset? LastHeartbeatAt { get; private set; }
    public DateTimeOffset? LastIngestAt { get; private set; }
    public string? LastIp { get; private set; }
    public int? ClockSkewSeconds { get; private set; }
    public string CapabilitiesJson { get; private set; } = "{}";
    public string HealthSummaryJson { get; private set; } = "{}";
    public DateTimeOffset? RevokedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    private Source() { }

    public static Source Create(
        Guid companyId,
        Guid siteId,
        SourceType sourceType,
        Guid installationId,
        string displayName,
        string platform,
        string architecture,
        string currentVersion,
        int heartbeatIntervalSeconds = 60)
    {
        var now = DateTimeOffset.UtcNow;
        return new Source
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            SourceType = sourceType,
            InstallationId = installationId,
            DisplayName = displayName,
            Platform = platform,
            Architecture = architecture,
            CurrentVersion = currentVersion,
            HeartbeatIntervalSeconds = heartbeatIntervalSeconds,
            Status = SourceStatus.Online,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void RecordHeartbeat(DateTimeOffset sourceTime, string? lastIp = null)
    {
        LastHeartbeatAt = DateTimeOffset.UtcNow;
        LastIp = lastIp;
        ClockSkewSeconds = (int)(DateTimeOffset.UtcNow - sourceTime).TotalSeconds;

        if (Status == SourceStatus.Offline || Status == SourceStatus.Pending)
        {
            Status = SourceStatus.Online;
        }

        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void RecordIngest()
    {
        LastIngestAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkDegraded()
    {
        Status = SourceStatus.Degraded;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkOffline()
    {
        Status = SourceStatus.Offline;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Revoke()
    {
        Status = SourceStatus.Revoked;
        RevokedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateConfigVersion(long newVersion)
    {
        if (newVersion > ConfigVersion)
        {
            ConfigVersion = newVersion;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void UpdateVersion(string version)
    {
        CurrentVersion = version;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetCapabilities(string capabilitiesJson)
    {
        CapabilitiesJson = capabilitiesJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetHealthSummary(string healthSummaryJson)
    {
        HealthSummaryJson = healthSummaryJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public bool IsActive => Status != SourceStatus.Revoked && Status != SourceStatus.Pending && DeletedAt == null;
    public bool IsOnline => Status == SourceStatus.Online || Status == SourceStatus.Degraded;
}
