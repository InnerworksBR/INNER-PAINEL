using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Credencial de uma source (JWT access + refresh tokens).
/// </summary>
public sealed class SourceCredential
{
    public Guid Id { get; private set; }
    public Guid SourceId { get; private set; }
    public Guid FamilyId { get; private set; }
    public int CredentialVersion { get; private set; }
    public string RefreshTokenHash { get; private set; } = string.Empty;
    public DateTimeOffset IssuedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? LastUsedAt { get; private set; }
    public Guid? ReplacedById { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public DateTimeOffset? ReuseDetectedAt { get; private set; }

    private SourceCredential() { }

    public static SourceCredential Create(Guid sourceId, string refreshTokenHash)
    {
        return new SourceCredential
        {
            Id = Guid.NewGuid(),
            SourceId = sourceId,
            FamilyId = Guid.NewGuid(),
            CredentialVersion = 1,
            RefreshTokenHash = refreshTokenHash,
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };
    }

    public SourceCredential Rotate(string newRefreshTokenHash)
    {
        var newCredential = new SourceCredential
        {
            Id = Guid.NewGuid(),
            SourceId = SourceId,
            FamilyId = FamilyId,
            CredentialVersion = CredentialVersion + 1,
            RefreshTokenHash = newRefreshTokenHash,
            IssuedAt = DateTimeOffset.UtcNow,
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(7)
        };

        RevokedAt = DateTimeOffset.UtcNow;
        ReplacedById = newCredential.Id;

        return newCredential;
    }

    public void MarkAsUsed()
    {
        LastUsedAt = DateTimeOffset.UtcNow;
    }

    public void MarkReuseDetected()
    {
        ReuseDetectedAt = DateTimeOffset.UtcNow;
    }

    public bool IsExpired => ExpiresAt <= DateTimeOffset.UtcNow;
    public bool IsRevoked => RevokedAt != null;
    public bool IsActive => !IsExpired && !IsRevoked;
}
