namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Range de rede para descoberta SNMP.
/// </summary>
public sealed class NetworkRange
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SiteId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Cidr { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Status { get; private set; } = "active"; // active, paused, disabled
    public int DiscoveryIntervalMinutes { get; private set; } = 1440; // 24h default
    public DateTimeOffset? LastDiscoveryAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    // Navigation property
    public Site? Site { get; private set; }

    private NetworkRange() { }

    /// <summary>
    /// Cria um range simplificado.
    /// </summary>
    public static NetworkRange Create(
        Guid companyId,
        Guid siteId,
        string name,
        string cidr,
        string? description = null)
    {
        var now = DateTimeOffset.UtcNow;
        return new NetworkRange
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            Name = name,
            Cidr = cidr,
            Description = description,
            Status = "active",
            DiscoveryIntervalMinutes = 1440,
            CreatedBy = Guid.Empty,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void UpdateLastDiscovery()
    {
        LastDiscoveryAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SetDiscoveryInterval(int minutes)
    {
        DiscoveryIntervalMinutes = minutes;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateName(string name)
    {
        Name = name;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateDescription(string description)
    {
        Description = description;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateStatus(string status)
    {
        Status = status;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Pause()
    {
        Status = "paused";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Resume()
    {
        Status = "active";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkDeleted()
    {
        Status = "disabled";
        DeletedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
