using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Representa um ativo monitorado.
/// </summary>
public sealed class Asset
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SiteId { get; private set; }
    public string AssetType { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public string LifecycleStatus { get; private set; } = "active";
    public string? Manufacturer { get; private set; }
    public string? Model { get; private set; }
    public string? SerialNumber { get; private set; }
    public string? PrimaryIp { get; private set; }
    public string? PrimaryMac { get; private set; }
    public string? Hostname { get; private set; }
    public string Properties { get; private set; } = "{}";
    public List<string> Tags { get; private set; } = new();
    public DateTimeOffset FirstSeenAt { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    private Asset() { }

    public static Asset Create(
        Guid companyId,
        Guid siteId,
        string assetType,
        string displayName)
    {
        var now = DateTimeOffset.UtcNow;
        return new Asset
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            AssetType = assetType,
            DisplayName = displayName,
            LifecycleStatus = "active",
            FirstSeenAt = now,
            LastSeenAt = now,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void UpdateProperties(string propertiesJson)
    {
        Properties = propertiesJson;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void UpdateDisplayName(string displayName)
    {
        DisplayName = displayName;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkDeleted()
    {
        DeletedAt = DateTimeOffset.UtcNow;
        LifecycleStatus = "deleted";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkRetired()
    {
        LifecycleStatus = "retired";
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
