using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/default-site")]
[Produces("application/json")]
[RequirePortalAuth(PortalRoles.CompanyAdmin, PortalRoles.PlatformAdmin)]
public sealed class DefaultSitesController : PortalControllerBase
{
    private readonly MonitoringDbContext _db;

    public DefaultSitesController(MonitoringDbContext db)
    {
        _db = db;
    }

    [HttpPost]
    public async Task<IActionResult> EnsureDefaultSite(Guid companyId, CancellationToken cancellationToken)
    {
        if (GetCompanyId() != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var site = await _db.Sites
            .Where(item => item.CompanyId == companyId && item.DeletedAt == null)
            .OrderBy(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        if (site == null)
        {
            site = Site.Create(companyId, "Sede", "default");
            _db.Sites.Add(site);
            await _db.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { id = site.Id, name = site.Name });
    }
}
