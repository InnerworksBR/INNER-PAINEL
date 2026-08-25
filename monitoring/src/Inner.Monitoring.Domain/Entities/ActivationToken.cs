using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Token de ativação para registro de uma nova source.
/// </summary>
public sealed class ActivationToken
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? SiteId { get; private set; }
    public SourceType SourceType { get; private set; }
    public string TokenHash { get; private set; } = string.Empty;
    public string DisplayHint { get; private set; } = string.Empty;
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? UsedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string Metadata { get; private set; } = "{}";

    private ActivationToken() { }

    /// <summary>
    /// Cria um token para uso interno (sem createdBy obrigatório).
    /// </summary>
    public static ActivationToken Create(
        Guid companyId,
        Guid? siteId,
        SourceType sourceType,
        string tokenHash,
        string? displayHint = null)
    {
        return new ActivationToken
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            SourceType = sourceType,
            TokenHash = tokenHash,
            DisplayHint = displayHint ?? "",
            ExpiresAt = DateTimeOffset.UtcNow.AddMinutes(60),
            CreatedBy = Guid.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            Metadata = "{}"
        };
    }

    public bool IsValid =>
        UsedAt == null &&
        RevokedAt == null &&
        ExpiresAt > DateTimeOffset.UtcNow;

    public bool IsUsed => UsedAt != null;
    public bool IsExpired => ExpiresAt <= DateTimeOffset.UtcNow;
    public bool IsRevoked => RevokedAt != null;

    public void MarkUsed() => UsedAt = DateTimeOffset.UtcNow;

    public void Revoke() => RevokedAt = DateTimeOffset.UtcNow;

    public void UpdateExpiry(DateTimeOffset expiresAt)
    {
        ExpiresAt = expiresAt;
    }
}
