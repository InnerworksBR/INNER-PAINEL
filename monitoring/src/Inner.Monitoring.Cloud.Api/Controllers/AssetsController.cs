using Inner.Monitoring.Application.QueryServices;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Microsoft.AspNetCore.Mvc;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de assets.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/assets")]
[Produces("application/json")]
[RequirePortalAuth]
public class AssetsController : PortalControllerBase
{
    private readonly IAssetQueryService _assetService;
    private readonly ILogger<AssetsController> _logger;

    public AssetsController(
        IAssetQueryService assetService,
        ILogger<AssetsController> logger)
    {
        _assetService = assetService;
        _logger = logger;
    }

    /// <summary>
    /// Lista assets com filtros e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AssetListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListAssets(
        [FromRoute] Guid companyId,
        [FromQuery] Guid? site,
        [FromQuery] string? type,
        [FromQuery] string? state,
        [FromQuery] Guid? source,
        [FromQuery] string? text,
        [FromQuery] int? freshness,
        [FromQuery] string? tags,
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

        var query = new AssetQuery
        {
            SiteId = site,
            AssetType = type,
            State = state,
            SourceId = source,
            Text = text,
            FreshnessMaxSeconds = freshness,
            Tags = string.IsNullOrEmpty(tags) ? null : tags.Split(',').ToList(),
            Page = Math.Max(1, page),
            PageSize = Math.Clamp(page_size, 1, 100),
            SortBy = sort_by,
            SortDescending = sort_desc,
            Cursor = cursor
        };

        // Injetar company_id da query
        var result = await _assetService.ListAssetsAsync(query with { }, cancellationToken);

        return Ok(new AssetListResponse(
            Items: result.Items,
            Page: result.Page,
            PageSize: result.PageSize,
            TotalItems: result.TotalItems,
            TotalPages: result.TotalPages,
            NextCursor: result.NextCursor));
    }

    /// <summary>
    /// Obtém detalhes de um asset específico.
    /// </summary>
    [HttpGet("{assetId:guid}")]
    [ProducesResponseType(typeof(AssetDetailResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetAssetDetail(
        [FromRoute] Guid companyId,
        [FromRoute] Guid assetId,
        CancellationToken cancellationToken)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            return Forbid();
        }

        var detail = await _assetService.GetAssetDetailAsync(companyId, assetId, cancellationToken);

        if (detail == null)
        {
            return NotFound(new { error = "Asset not found" });
        }

        return Ok(detail);
    }
}
