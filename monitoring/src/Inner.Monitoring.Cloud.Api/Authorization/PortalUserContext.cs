using System.Security.Claims;

namespace Inner.Monitoring.Cloud.Api.Authorization;

/// <summary>
/// Claims do JWT para usuários do portal.
/// </summary>
public static class PortalClaims
{
    public const string CompanyId = "company_id";
    public const string UserId = "user_id";
    public const string Role = "role";
    public const string Email = "email";
}

/// <summary>
/// Papéis de usuário.
/// </summary>
public static class PortalRoles
{
    public const string PlatformAdmin = "platform_admin";
    public const string CompanyAdmin = "company_admin";
    public const string Operator = "operator";
    public const string Viewer = "viewer";
    public const string Auditor = "auditor";

    public static readonly string[] All = { PlatformAdmin, CompanyAdmin, Operator, Viewer, Auditor };

    public static bool IsAtLeast(string? userRole, string requiredRole)
    {
        if (string.IsNullOrEmpty(userRole)) return false;

        var hierarchy = new Dictionary<string, int>
        {
            { Auditor, 1 },
            { Viewer, 2 },
            { Operator, 3 },
            { CompanyAdmin, 4 },
            { PlatformAdmin, 5 }
        };

        var userLevel = hierarchy.GetValueOrDefault(userRole, 0);
        var requiredLevel = hierarchy.GetValueOrDefault(requiredRole, 0);

        return userLevel >= requiredLevel;
    }
}

/// <summary>
/// Contexto do usuário extraído do JWT.
/// </summary>
public sealed class PortalUserContext
{
    public Guid UserId { get; }
    public Guid? CompanyId { get; }
    public string Role { get; }
    public string? Email { get; }
    public bool IsPlatformAdmin => Role == PortalRoles.PlatformAdmin;

    public PortalUserContext(ClaimsPrincipal principal)
    {
        UserId = principal.FindFirst(PortalClaims.UserId)?.Value is { } uid && Guid.TryParse(uid, out var u)
            ? u
            : Guid.Empty;

        CompanyId = principal.FindFirst(PortalClaims.CompanyId)?.Value is { } cid && Guid.TryParse(cid, out var c)
            ? c
            : null;

        // JwtBearer pode mapear o claim JWT "role" para ClaimTypes.Role.
        // Aceitar ambos mantém compatibilidade com tokens emitidos pelo portal.
        Role = principal.FindFirst(PortalClaims.Role)?.Value
            ?? principal.FindFirst(ClaimTypes.Role)?.Value
            ?? PortalRoles.Viewer;
        Email = principal.FindFirst(PortalClaims.Email)?.Value;
    }

    /// <summary>
    /// Verifica se o usuário pode acessar dados da empresa.
    /// </summary>
    public bool CanAccessCompany(Guid targetCompanyId)
    {
        if (IsPlatformAdmin) return true;
        return CompanyId.HasValue && CompanyId.Value == targetCompanyId;
    }
}
