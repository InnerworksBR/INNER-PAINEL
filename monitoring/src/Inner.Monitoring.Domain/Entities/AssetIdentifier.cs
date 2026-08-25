using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Identificador único de um asset.
/// </summary>
public sealed class AssetIdentifier
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid AssetId { get; private set; }
    public string IdentifierType { get; private set; } = string.Empty;
    public string NormalizedValue { get; private set; } = string.Empty;
    public byte[] ValueHash { get; private set; } = Array.Empty<byte>();
    public IdentifierConfidence Confidence { get; private set; }
    public IdentifierStatus Status { get; private set; } = IdentifierStatus.Active;
    public DateTimeOffset FirstSeenAt { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public Guid SourceId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private AssetIdentifier() { }

    public static AssetIdentifier Create(
        Guid companyId,
        Guid assetId,
        string identifierType,
        string normalizedValue,
        byte[] valueHash,
        IdentifierConfidence confidence,
        Guid sourceId)
    {
        var now = DateTimeOffset.UtcNow;
        return new AssetIdentifier
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            AssetId = assetId,
            IdentifierType = identifierType,
            NormalizedValue = normalizedValue,
            ValueHash = valueHash,
            Confidence = confidence,
            Status = IdentifierStatus.Active,
            FirstSeenAt = now,
            LastSeenAt = now,
            SourceId = sourceId,
            CreatedAt = now
        };
    }

    public void UpdateLastSeen()
    {
        LastSeenAt = DateTimeOffset.UtcNow;
    }

    public void Retire()
    {
        Status = IdentifierStatus.Retired;
    }

    public void MarkConflicted()
    {
        Status = IdentifierStatus.Conflicted;
    }
}
