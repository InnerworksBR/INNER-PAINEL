namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Binding entre NetworkRange e SnmpCredential.
/// </summary>
public sealed class RangeCredentialBinding
{
    public Guid RangeId { get; private set; }
    public Guid CredentialId { get; private set; }
    public Guid CompanyId { get; private set; }
    public int Priority { get; private set; } = 100;
    public string Status { get; private set; } = "active"; // active, disabled
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private RangeCredentialBinding() { }

    public static RangeCredentialBinding Create(
        Guid rangeId,
        Guid credentialId,
        Guid companyId,
        int priority = 100)
    {
        var now = DateTimeOffset.UtcNow;
        return new RangeCredentialBinding
        {
            RangeId = rangeId,
            CredentialId = credentialId,
            CompanyId = companyId,
            Priority = priority,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Disable()
    {
        Status = "disabled";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Enable()
    {
        Status = "active";
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
