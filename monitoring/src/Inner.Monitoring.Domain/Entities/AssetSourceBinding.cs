namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Binding entre asset e source.
/// </summary>
public sealed class AssetSourceBinding
{
    public Guid AssetId { get; private set; }
    public Guid SourceId { get; private set; }
    public string LocalAssetId { get; private set; } = string.Empty;
    public string Role { get; private set; } = "primary"; // primary, secondary, discovery, inventory
    public DateTimeOffset FirstSeenAt { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public bool Active { get; private set; } = true;

    private AssetSourceBinding() { }

    public static AssetSourceBinding Create(
        Guid assetId,
        Guid sourceId,
        string localAssetId,
        string role = "primary")
    {
        var now = DateTimeOffset.UtcNow;
        return new AssetSourceBinding
        {
            AssetId = assetId,
            SourceId = sourceId,
            LocalAssetId = localAssetId,
            Role = role,
            FirstSeenAt = now,
            LastSeenAt = now,
            Active = true
        };
    }

    public void UpdateLastSeen()
    {
        LastSeenAt = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        Active = false;
    }
}
