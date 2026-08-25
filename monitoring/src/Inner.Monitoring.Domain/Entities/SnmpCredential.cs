namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Credencial SNMP.
/// </summary>
public sealed class SnmpCredential
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SiteId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Version { get; private set; } = "v2c"; // v2c, v3
    public string? SecurityLevel { get; private set; } // noAuthNoPriv, authNoPriv, authPriv
    public string? Username { get; private set; }
    public string? AuthProtocol { get; private set; }
    public string? PrivacyProtocol { get; private set; }
    public string EncryptedSecret { get; private set; } = string.Empty;
    public string Nonce { get; private set; } = string.Empty;
    public string Tag { get; private set; } = string.Empty;
    public int KeyVersion { get; private set; }
    public string Fingerprint { get; private set; } = string.Empty;
    public string Status { get; private set; } = "active"; // active, disabled, rotating
    public Guid CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? RotatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    private SnmpCredential() { }

    /// <summary>
    /// Cria uma credencial simplificada.
    /// </summary>
    public static SnmpCredential Create(
        Guid companyId,
        Guid siteId,
        string name,
        string version,
        string? securityLevel,
        string? username,
        string? authProtocol,
        string? privacyProtocol,
        string encryptedSecret,
        string nonce)
    {
        return new SnmpCredential
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            Name = name,
            Version = version,
            SecurityLevel = securityLevel,
            Username = username,
            AuthProtocol = authProtocol,
            PrivacyProtocol = privacyProtocol,
            EncryptedSecret = encryptedSecret,
            Nonce = nonce,
            Tag = Guid.NewGuid().ToString("N"),
            KeyVersion = 1,
            Fingerprint = "",
            Status = "active",
            CreatedBy = Guid.Empty,
            CreatedAt = DateTimeOffset.UtcNow,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    public void MarkDeleted()
    {
        DeletedAt = DateTimeOffset.UtcNow;
        Status = "disabled";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Rotate(string newEncryptedSecret, string newNonce)
    {
        EncryptedSecret = newEncryptedSecret;
        Nonce = newNonce;
        KeyVersion++;
        RotatedAt = DateTimeOffset.UtcNow;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
