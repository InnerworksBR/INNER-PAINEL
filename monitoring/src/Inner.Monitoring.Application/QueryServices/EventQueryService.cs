using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Application.QueryServices;

/// <summary>
/// Implementação do serviço de query para eventos.
/// </summary>
public class EventQueryService : IEventQueryService
{
    private readonly MonitoringDbContext _db;

    public EventQueryService(MonitoringDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<EventResponse>> ListEventsAsync(Guid companyId, EventQuery query, CancellationToken ct = default)
    {
        var baseQuery = _db.MonitoringEvents
            .Where(e => e.CompanyId == companyId);

        // Aplicar filtros
        var filteredQuery = ApplyFilters(baseQuery, query);

        // Total
        var totalItems = await filteredQuery.CountAsync(ct);

        // Ordenação
        var orderedQuery = ApplySorting(filteredQuery, query);

        // Cursor ou paginação
        IQueryable<Domain.Entities.MonitoringEvent> pagedQuery;
        string? nextCursor = null;

        if (!string.IsNullOrEmpty(query.Cursor))
        {
            var cursor = DecodeCursor(query.Cursor);
            pagedQuery = orderedQuery.Where(e => e.OccurredAt < cursor.OccurredAt || e.Id.CompareTo(cursor.Id) < 0);
        }
        else
        {
            pagedQuery = orderedQuery.Skip((query.Page - 1) * query.PageSize);
        }

        var items = await pagedQuery
            .Take(query.PageSize + 1)
            .ToListAsync(ct);

        // Verificar próxima página
        if (items.Count > query.PageSize)
        {
            items = items.Take(query.PageSize).ToList();
            var last = items.Last();
            nextCursor = EncodeCursor(last.OccurredAt, last.Id);
        }

        // Carregar assets para nomes
        var assetIds = items.Where(e => e.AssetId.HasValue).Select(e => e.AssetId!.Value).Distinct().ToList();
        var assets = await _db.Assets
            .Where(a => assetIds.Contains(a.Id))
            .ToDictionaryAsync(a => a.Id, a => a.DisplayName, ct);

        // Carregar sites
        var siteIds = items.Where(e => e.SiteId.HasValue).Select(e => e.SiteId!.Value).Distinct().ToList();
        var sites = await _db.Sites
            .Where(s => siteIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name, ct);

        var result = items.Select(e =>
        {
            assets.TryGetValue(e.AssetId!.Value, out var assetName);
            sites.TryGetValue(e.SiteId!.Value, out var siteName);

            return MapToResponse(e, assetName, siteName);
        }).ToList();

        var totalPages = (int)Math.Ceiling((double)totalItems / query.PageSize);

        return new PagedResult<EventResponse>(
            Items: result,
            Page: query.Page,
            PageSize: query.PageSize,
            TotalItems: totalItems,
            TotalPages: totalPages,
            NextCursor: nextCursor);
    }

    public async Task<IReadOnlyList<EventResponse>> GetRecentEventsForAssetAsync(
        Guid companyId,
        Guid assetId,
        int limit = 10,
        CancellationToken ct = default)
    {
        var events = await _db.MonitoringEvents
            .Where(e => e.CompanyId == companyId && e.AssetId == assetId)
            .OrderByDescending(e => e.OccurredAt)
            .Take(limit)
            .ToListAsync(ct);

        return events.Select(e => MapToResponse(e, null, null)).ToList();
    }

    private static IQueryable<Domain.Entities.MonitoringEvent> ApplyFilters(
        IQueryable<Domain.Entities.MonitoringEvent> query,
        EventQuery filters)
    {
        if (filters.SiteId.HasValue)
            query = query.Where(e => e.SiteId == filters.SiteId.Value);

        if (filters.AssetId.HasValue)
            query = query.Where(e => e.AssetId == filters.AssetId.Value);

        if (!string.IsNullOrEmpty(filters.EventType))
            query = query.Where(e => e.EventType == filters.EventType);

        if (!string.IsNullOrEmpty(filters.Severity))
        {
            if (Enum.TryParse<EventSeverity>(filters.Severity, true, out var sev))
                query = query.Where(e => e.Severity == sev);
        }

        if (!string.IsNullOrEmpty(filters.State))
        {
            if (Enum.TryParse<EventState>(filters.State, true, out var state))
                query = query.Where(e => e.State == state);
        }

        if (filters.From.HasValue)
            query = query.Where(e => e.OccurredAt >= filters.From.Value);

        if (filters.To.HasValue)
            query = query.Where(e => e.OccurredAt <= filters.To.Value);

        return query;
    }

    private static IQueryable<Domain.Entities.MonitoringEvent> ApplySorting(
        IQueryable<Domain.Entities.MonitoringEvent> query,
        EventQuery filters)
    {
        return (filters.SortBy?.ToLower(), filters.SortDescending) switch
        {
            ("severity", true) => query.OrderByDescending(e => e.Severity).ThenByDescending(e => e.OccurredAt),
            ("severity", false) => query.OrderBy(e => e.Severity).ThenByDescending(e => e.OccurredAt),
            ("type", true) => query.OrderByDescending(e => e.EventType).ThenByDescending(e => e.OccurredAt),
            ("type", false) => query.OrderBy(e => e.EventType).ThenByDescending(e => e.OccurredAt),
            _ => query.OrderByDescending(e => e.OccurredAt)
        };
    }

    private static EventResponse MapToResponse(
        Domain.Entities.MonitoringEvent e,
        string? assetName,
        string? siteName)
    {
        return new EventResponse(
            Id: e.Id,
            CompanyId: e.CompanyId,
            SiteId: e.SiteId,
            SiteName: siteName,
            AssetId: e.AssetId,
            AssetName: assetName,
            SourceId: e.SourceId,
            EventType: e.EventType,
            Severity: e.Severity,
            Title: e.Title,
            Message: e.Message,
            EventKey: e.EventKey,
            State: e.State,
            OccurredAt: e.OccurredAt,
            ResolvedAt: e.ResolvedAt,
            PayloadJson: e.Payload == "{}" ? null : e.Payload,
            CreatedAt: e.CreatedAt);
    }

    private static string EncodeCursor(DateTimeOffset occurredAt, Guid id)
    {
        return $"{occurredAt:O}|{id}";
    }

    private static (DateTimeOffset OccurredAt, Guid Id) DecodeCursor(string cursor)
    {
        var parts = cursor.Split('|');
        return (
            DateTimeOffset.Parse(parts[0]),
            Guid.Parse(parts[1]));
    }
}
