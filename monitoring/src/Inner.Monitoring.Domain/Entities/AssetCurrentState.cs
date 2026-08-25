using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Estado atual de um asset.
/// </summary>
public sealed class AssetCurrentState
{
    public Guid AssetId { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SourceId { get; private set; }
    public HealthStatus Health { get; private set; } = HealthStatus.Unknown;
    public DateTimeOffset? LastAttemptAt { get; private set; }
    public DateTimeOffset? LastSuccessAt { get; private set; }
    public int? FreshnessSeconds { get; private set; }
    public int ExpectedIntervalSeconds { get; private set; } = 60;
    public int ConsecutiveFailures { get; private set; }
    public string? LastFailureResult { get; private set; }
    public string? LastFailureCode { get; private set; }
    public string Summary { get; private set; } = "{}";
    public DateTimeOffset ComputedAt { get; private set; }
    public long Version { get; private set; } = 1;

    private AssetCurrentState() { }

    public static AssetCurrentState Create(
        Guid assetId,
        Guid companyId,
        Guid sourceId,
        HealthStatus health,
        int expectedIntervalSeconds)
    {
        return new AssetCurrentState
        {
            AssetId = assetId,
            CompanyId = companyId,
            SourceId = sourceId,
            Health = health,
            ExpectedIntervalSeconds = expectedIntervalSeconds,
            ComputedAt = DateTimeOffset.UtcNow,
            Version = 1
        };
    }

    public void RecordSuccess(DateTimeOffset timestamp, int freshnessSeconds)
    {
        LastAttemptAt = timestamp;
        LastSuccessAt = timestamp;
        FreshnessSeconds = freshnessSeconds;
        ConsecutiveFailures = 0;
        LastFailureResult = null;
        LastFailureCode = null;
        ComputedAt = DateTimeOffset.UtcNow;
        Version++;
    }

    public void RecordFailure(
        DateTimeOffset timestamp,
        string result,
        string? errorCode = null)
    {
        LastAttemptAt = timestamp;
        ConsecutiveFailures++;
        LastFailureResult = result;
        LastFailureCode = errorCode;
        FreshnessSeconds = null;
        ComputedAt = DateTimeOffset.UtcNow;
        Version++;
    }

    public void UpdateHealth(HealthStatus newHealth)
    {
        if (Health != newHealth)
        {
            Health = newHealth;
            ComputedAt = DateTimeOffset.UtcNow;
            Version++;
        }
    }

    public void MarkUnknown()
    {
        Health = HealthStatus.Unknown;
        ComputedAt = DateTimeOffset.UtcNow;
        Version++;
    }

    public void MarkMaintenance()
    {
        Health = HealthStatus.Maintenance;
        ComputedAt = DateTimeOffset.UtcNow;
        Version++;
    }
}
