namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Conflito de identidade de asset (mesmo identificador em múltiplos assets).
/// </summary>
public sealed class AssetIdentityConflict
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public string IdentifierType { get; private set; } = string.Empty;
    public string NormalizedValue { get; private set; } = string.Empty;
    public Guid AssetId1 { get; private set; }
    public Guid AssetId2 { get; private set; }
    public string ConflictType { get; private set; } = string.Empty; // duplicate, merge_needed
    public string Status { get; private set; } = "open"; // open, investigating, resolved, ignored
    public string? Resolution { get; private set; }
    public Guid? ResolvedBy { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }
    public DateTimeOffset DetectedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private AssetIdentityConflict() { }

    public static AssetIdentityConflict Create(
        Guid companyId,
        string identifierType,
        string normalizedValue,
        Guid assetId1,
        Guid assetId2,
        string conflictType)
    {
        var now = DateTimeOffset.UtcNow;
        return new AssetIdentityConflict
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            IdentifierType = identifierType,
            NormalizedValue = normalizedValue,
            AssetId1 = assetId1,
            AssetId2 = assetId2,
            ConflictType = conflictType,
            Status = "open",
            DetectedAt = now,
            CreatedAt = now
        };
    }

    public void Resolve(string resolution, Guid resolvedBy)
    {
        Status = "resolved";
        Resolution = resolution;
        ResolvedBy = resolvedBy;
        ResolvedAt = DateTimeOffset.UtcNow;
    }

    public void Ignore()
    {
        Status = "ignored";
    }

    public void MarkInvestigating()
    {
        Status = "investigating";
    }
}
