namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Perfil de coleta com métricas e intervalos.
/// </summary>
public sealed class CollectionProfile
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string ProfileType { get; private set; } = string.Empty; // windows, hyperv, switch, etc
    public string Metrics { get; private set; } = "[]"; // JSON array of metric keys
    public int IntervalSeconds { get; private set; } = 60;
    public bool Active { get; private set; } = true;
    public int Priority { get; private set; } = 100;
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    private CollectionProfile() { }

    public static CollectionProfile Create(
        Guid companyId,
        string name,
        string description,
        string profileType,
        string metrics,
        int intervalSeconds,
        int priority,
        Guid createdBy)
    {
        var now = DateTimeOffset.UtcNow;
        return new CollectionProfile
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Name = name,
            Description = description,
            ProfileType = profileType,
            Metrics = metrics,
            IntervalSeconds = intervalSeconds,
            Active = true,
            Priority = priority,
            CreatedBy = createdBy,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Deactivate()
    {
        Active = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateMetrics(string metrics)
    {
        Metrics = metrics;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateInterval(int intervalSeconds)
    {
        IntervalSeconds = intervalSeconds;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
