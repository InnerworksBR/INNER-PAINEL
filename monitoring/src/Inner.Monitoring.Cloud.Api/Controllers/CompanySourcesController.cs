using Inner.Monitoring.Application.QueryServices;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Microsoft.AspNetCore.Mvc;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de sources.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/sources")]
[Produces("application/json")]
[RequirePortalAuth]
public class CompanySourcesController : PortalControllerBase
{
    private readonly ISourceQueryService _sourceService;
    private readonly ILogger<CompanySourcesController> _logger;

    public CompanySourcesController(
        ISourceQueryService sourceService,
        ILogger<CompanySourcesController> logger)
    {
        _sourceService = sourceService;
        _logger = logger;
    }

    /// <summary>
    /// Lista sources com filtros e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(SourceListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListSources(
        [FromRoute] Guid companyId,
        [FromQuery] Guid? site,
        [FromQuery] string? type,
        [FromQuery] string? status,
        [FromQuery] string? text,
        [FromQuery] int page = 1,
        [FromQuery] int page_size = 50,
        [FromQuery] string? sort_by = null,
        [FromQuery] bool sort_desc = true,
        [FromQuery] string? cursor = null,
        CancellationToken cancellationToken = default)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var query = new SourceQuery
        {
            SiteId = site,
            SourceType = type,
            Status = status,
            Text = text,
            Page = Math.Max(1, page),
            PageSize = Math.Clamp(page_size, 1, 100),
            SortBy = sort_by,
            SortDescending = sort_desc,
            Cursor = cursor
        };

        var result = await _sourceService.ListSourcesAsync(companyId, query, cancellationToken);

        return Ok(new SourceListResponse(
            Items: result.Items,
            Page: result.Page,
            PageSize: result.PageSize,
            TotalItems: result.TotalItems,
            TotalPages: result.TotalPages,
            NextCursor: result.NextCursor));
    }
}
