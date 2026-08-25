using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Domain.Entities;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de network ranges.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/network-ranges")]
[Produces("application/json")]
[RequirePortalAuth(PortalRoles.CompanyAdmin, PortalRoles.Operator, PortalRoles.PlatformAdmin)]
public class NetworkRangesController : PortalControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly ILogger<NetworkRangesController> _logger;

    public NetworkRangesController(
        MonitoringDbContext db,
        ILogger<NetworkRangesController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Lista network ranges.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<NetworkRangeResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListRanges(
        [FromRoute] Guid companyId,
        [FromQuery] Guid? site_id,
        CancellationToken cancellationToken = default)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var query = _db.NetworkRanges
            .Include(r => r.Site)
            .Where(r => r.CompanyId == companyId && r.DeletedAt == null);

        if (site_id.HasValue)
        {
            query = query.Where(r => r.SiteId == site_id.Value);
        }

        var ranges = await query
            .OrderByDescending(r => r.CreatedAt)
            .Take(100)
            .ToListAsync(cancellationToken);

        return Ok(ranges.Select(r => MapToResponse(r)).ToList());
    }

    /// <summary>
    /// Obtém detalhes de um network range.
    /// </summary>
    [HttpGet("{rangeId:guid}")]
    [ProducesResponseType(typeof(NetworkRangeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetRange(
        [FromRoute] Guid companyId,
        [FromRoute] Guid rangeId,
        CancellationToken cancellationToken)
    {
        var range = await _db.NetworkRanges
            .Include(r => r.Site)
            .FirstOrDefaultAsync(r => r.Id == rangeId && r.CompanyId == companyId && r.DeletedAt == null, cancellationToken);

        if (range == null)
        {
            return NotFound(new { error = "Network range not found" });
        }

        return Ok(MapToResponse(range));
    }

    /// <summary>
    /// Cria um novo network range.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(NetworkRangeResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> CreateRange(
        [FromRoute] Guid companyId,
        [FromBody] CreateNetworkRangeRequest request,
        CancellationToken cancellationToken)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        // Validar site
        var site = await _db.Sites
            .FirstOrDefaultAsync(s => s.Id == request.SiteId && s.CompanyId == companyId, cancellationToken);

        if (site == null)
        {
            return BadRequest(new { error = "Site not found" });
        }

        // Validar CIDR
        if (!IsValidCidr(request.Cidr))
        {
            return BadRequest(new { error = "Invalid CIDR format" });
        }

        var range = NetworkRange.Create(
            companyId,
            request.SiteId,
            request.Name,
            request.Cidr,
            request.Description);

        range.SetDiscoveryInterval(request.DiscoveryIntervalMinutes ?? 60);

        _db.NetworkRanges.Add(range);
        await _db.SaveChangesAsync(cancellationToken);

        _logger.LogInformation(
            "Network range created: {RangeId} for company {CompanyId}",
            range.Id, companyId);

        return CreatedAtAction(nameof(GetRange), new { companyId, rangeId = range.Id },
            MapToResponse(range, site.Name));
    }

    /// <summary>
    /// Atualiza um network range.
    /// </summary>
    [HttpPut("{rangeId:guid}")]
    [ProducesResponseType(typeof(NetworkRangeResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UpdateRange(
        [FromRoute] Guid companyId,
        [FromRoute] Guid rangeId,
        [FromBody] UpdateNetworkRangeRequest request,
        CancellationToken cancellationToken)
    {
        var range = await _db.NetworkRanges
            .Include(r => r.Site)
            .FirstOrDefaultAsync(r => r.Id == rangeId && r.CompanyId == companyId && r.DeletedAt == null, cancellationToken);

        if (range == null)
        {
            return NotFound(new { error = "Network range not found" });
        }

        if (!string.IsNullOrEmpty(request.Name))
            range.UpdateName(request.Name);

        if (!string.IsNullOrEmpty(request.Description))
            range.UpdateDescription(request.Description);

        if (request.Status != null)
            range.UpdateStatus(request.Status);

        if (request.DiscoveryIntervalMinutes.HasValue)
            range.SetDiscoveryInterval(request.DiscoveryIntervalMinutes.Value);

        await _db.SaveChangesAsync(cancellationToken);

        return Ok(MapToResponse(range));
    }

    /// <summary>
    /// Remove um network range.
    /// </summary>
    [HttpDelete("{rangeId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteRange(
        [FromRoute] Guid companyId,
        [FromRoute] Guid rangeId,
        CancellationToken cancellationToken)
    {
        var range = await _db.NetworkRanges
            .FirstOrDefaultAsync(r => r.Id == rangeId && r.CompanyId == companyId && r.DeletedAt == null, cancellationToken);

        if (range == null)
        {
            return NotFound(new { error = "Network range not found" });
        }

        range.MarkDeleted();
        await _db.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private static bool IsValidCidr(string cidr)
    {
        var parts = cidr.Split('/');
        if (parts.Length != 2) return false;

        if (!System.Net.IPAddress.TryParse(parts[0], out var ip)) return false;
        if (!int.TryParse(parts[1], out var prefix)) return false;

        return prefix >= 0 && prefix <= 32;
    }

    private static NetworkRangeResponse MapToResponse(NetworkRange r, string? siteName = null)
    {
        return new NetworkRangeResponse(
            Id: r.Id,
            CompanyId: r.CompanyId,
            SiteId: r.SiteId,
            SiteName: siteName ?? r.Site?.Name,
            Name: r.Name,
            Cidr: r.Cidr,
            Description: r.Description,
            Status: r.Status,
            DiscoveryIntervalMinutes: r.DiscoveryIntervalMinutes,
            LastDiscoveryAt: r.LastDiscoveryAt,
            CreatedAt: r.CreatedAt);
    }
}

public sealed record CreateNetworkRangeRequest(
    Guid SiteId,
    string Name,
    string Cidr,
    string? Description = null,
    int? DiscoveryIntervalMinutes = 60);

public sealed record UpdateNetworkRangeRequest(
    string? Name = null,
    string? Description = null,
    string? Status = null,
    int? DiscoveryIntervalMinutes = null);
