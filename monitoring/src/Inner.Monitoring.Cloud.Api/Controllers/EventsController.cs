using Inner.Monitoring.Application.QueryServices;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Microsoft.AspNetCore.Mvc;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para gerenciamento de eventos.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/events")]
[Produces("application/json")]
[RequirePortalAuth]
public class EventsController : PortalControllerBase
{
    private readonly IEventQueryService _eventService;
    private readonly ILogger<EventsController> _logger;

    public EventsController(
        IEventQueryService eventService,
        ILogger<EventsController> logger)
    {
        _eventService = eventService;
        _logger = logger;
    }

    /// <summary>
    /// Lista eventos com filtros e paginação.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(EventListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListEvents(
        [FromRoute] Guid companyId,
        [FromQuery] Guid? site,
        [FromQuery] Guid? asset,
        [FromQuery] string? event_type,
        [FromQuery] string? severity,
        [FromQuery] string? state,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
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

        var query = new EventQuery
        {
            SiteId = site,
            AssetId = asset,
            EventType = event_type,
            Severity = severity,
            State = state,
            From = from,
            To = to,
            Page = Math.Max(1, page),
            PageSize = Math.Clamp(page_size, 1, 100),
            SortBy = sort_by,
            SortDescending = sort_desc,
            Cursor = cursor
        };

        var result = await _eventService.ListEventsAsync(companyId, query, cancellationToken);

        return Ok(new EventListResponse(
            Items: result.Items,
            Page: result.Page,
            PageSize: result.PageSize,
            TotalItems: result.TotalItems,
            TotalPages: result.TotalPages,
            NextCursor: result.NextCursor));
    }
}
