using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Inner.Monitoring.Cloud.Api.Authorization;

/// <summary>
/// Atributo para exigir autenticação JWT de usuário.
/// </summary>
[AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
public class RequirePortalAuthAttribute : Attribute, IAuthorizationFilter
{
    private readonly string[]? _requiredRoles;

    public RequirePortalAuthAttribute(params string[]? requiredRoles)
    {
        _requiredRoles = requiredRoles;
    }

    public void OnAuthorization(AuthorizationFilterContext context)
    {
        var principal = context.HttpContext.User;

        if (principal?.Identity?.IsAuthenticated != true)
        {
            context.Result = new UnauthorizedObjectResult(new { error = "Authentication required" });
            return;
        }

        var userContext = new PortalUserContext(principal);

        // Verificar roles se especificado
        if (_requiredRoles != null && _requiredRoles.Length > 0)
        {
            var hasRole = _requiredRoles.Any(r => PortalRoles.IsAtLeast(userContext.Role, r));
            if (!hasRole)
            {
                context.Result = new ForbidResult();
                return;
            }
        }

        // Armazenar contexto no HttpContext
        context.HttpContext.Items["PortalUserContext"] = userContext;
    }
}

/// <summary>
/// Base para controllers do portal.
/// </summary>
public abstract class PortalControllerBase : ControllerBase
{
    /// <summary>
    /// Obtém o contexto do usuário atual.
    /// </summary>
    protected PortalUserContext GetUserContext()
    {
        if (HttpContext.Items.TryGetValue("PortalUserContext", out var ctx) && ctx is PortalUserContext userContext)
        {
            return userContext;
        }

        // Tentar extrair do ClaimsPrincipal
        return new PortalUserContext(User);
    }

    /// <summary>
    /// Obtém o company_id do token JWT (nunca do request).
    /// </summary>
    protected Guid GetCompanyId()
    {
        var ctx = GetUserContext();
        if (!ctx.CompanyId.HasValue)
        {
            throw new UnauthorizedAccessException("Company ID not found in token");
        }
        return ctx.CompanyId.Value;
    }

    /// <summary>
    /// Valida acesso à empresa.
    /// </summary>
    protected bool CanAccessCompany(Guid companyId)
    {
        return GetUserContext().CanAccessCompany(companyId);
    }
}
