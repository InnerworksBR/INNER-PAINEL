using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Representa um site (localidade/rede) de uma empresa.
/// </summary>
public sealed class Site
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Code { get; private set; }
    public string Timezone { get; private set; } = "America/Sao_Paulo";
    public string Status { get; private set; } = "active";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }

    private Site() { }

    public static Site Create(Guid companyId, string name, string? code = null, string timezone = "America/Sao_Paulo")
    {
        var now = DateTimeOffset.UtcNow;
        return new Site
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            Name = name,
            Code = code,
            Timezone = timezone,
            Status = "active",
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Deactivate()
    {
        Status = "disabled";
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkDeleted()
    {
        DeletedAt = DateTimeOffset.UtcNow;
        Status = "disabled";
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
