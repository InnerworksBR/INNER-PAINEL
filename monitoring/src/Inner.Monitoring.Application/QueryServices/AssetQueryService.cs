using System.Text.Json;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Application.QueryServices;

/// <summary>
/// Implementação do serviço de query para assets.
/// </summary>
public class AssetQueryService : IAssetQueryService
{
    private readonly MonitoringDbContext _db;

    public AssetQueryService(MonitoringDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<AssetSummary>> ListAssetsAsync(AssetQuery query, CancellationToken ct = default)
    {
        var companyId = GetCompanyIdFromQuery(query);
        if (companyId == null)
        {
            return new PagedResult<AssetSummary>(
                Items: Array.Empty<AssetSummary>(),
                Page: query.Page,
                PageSize: query.PageSize,
                TotalItems: 0,
                TotalPages: 0,
                NextCursor: null);
        }

        var baseQuery = _db.Assets
            .Where(a => a.CompanyId == companyId && a.DeletedAt == null);

        // Aplicar filtros
        var filteredQuery = ApplyFilters(baseQuery, query);

        // Total antes da paginação
        var totalItems = await filteredQuery.CountAsync(ct);

        // Ordenação
        var orderedQuery = ApplySorting(filteredQuery, query);

        // Cursor ou paginação
        IQueryable<Domain.Entities.Asset> pagedQuery;
        string? nextCursor = null;

        if (!string.IsNullOrEmpty(query.Cursor))
        {
            var cursor = DecodeCursor(query.Cursor);
            pagedQuery = orderedQuery.Where(a => a.LastSeenAt < cursor.LastSeen || a.Id.CompareTo(cursor.Id) < 0);
        }
        else
        {
            pagedQuery = orderedQuery.Skip((query.Page - 1) * query.PageSize);
        }

        var items = await pagedQuery
            .Take(query.PageSize + 1)
            .ToListAsync(ct);

        // Verificar se há próxima página
        if (items.Count > query.PageSize)
        {
            items = items.Take(query.PageSize).ToList();
            var last = items.Last();
            nextCursor = EncodeCursor(last.LastSeenAt, last.Id);
        }

        // Carregar states em batch
        var assetIds = items.Select(a => a.Id).ToList();
        var states = await _db.AssetCurrentStates
            .Where(s => s.CompanyId == companyId && assetIds.Contains(s.AssetId))
            .ToDictionaryAsync(s => s.AssetId, ct);

        // Carregar sites
        var siteIds = items.Select(a => a.SiteId).Distinct().ToList();
        var sites = await _db.Sites
            .Where(s => siteIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name, ct);

        var result = items.Select(a =>
        {
            states.TryGetValue(a.Id, out var state);
            sites.TryGetValue(a.SiteId, out var siteName);

            return MapToSummary(a, state, siteName ?? "Unknown");
        }).ToList();

        var totalPages = (int)Math.Ceiling((double)totalItems / query.PageSize);

        return new PagedResult<AssetSummary>(
            Items: result,
            Page: query.Page,
            PageSize: query.PageSize,
            TotalItems: totalItems,
            TotalPages: totalPages,
            NextCursor: nextCursor);
    }

    public async Task<AssetDetailResponse?> GetAssetDetailAsync(Guid companyId, Guid assetId, CancellationToken ct = default)
    {
        var asset = await _db.Assets
            .FirstOrDefaultAsync(a => a.Id == assetId && a.CompanyId == companyId && a.DeletedAt == null, ct);

        if (asset == null)
            return null;

        // Buscar site separadamente
        var site = await _db.Sites.FirstOrDefaultAsync(s => s.Id == asset.SiteId, ct);

        // State atual
        var state = await _db.AssetCurrentStates
            .FirstOrDefaultAsync(s => s.AssetId == assetId, ct);

        // Identificadores
        var identifiers = await _db.AssetIdentifiers
            .Where(i => i.AssetId == assetId && i.Status == IdentifierStatus.Active)
            .OrderByDescending(i => i.Confidence)
            .ThenBy(i => i.FirstSeenAt)
            .ToListAsync(ct);

        // Métricas atuais
        var metrics = await _db.AssetMetricCurrents
            .Where(m => m.AssetId == assetId)
            .Take(50)
            .ToListAsync(ct);

        // Eventos recentes
        var events = await _db.MonitoringEvents
            .Where(e => e.AssetId == assetId)
            .OrderByDescending(e => e.OccurredAt)
            .Take(20)
            .ToListAsync(ct);

        return new AssetDetailResponse(
            Id: asset.Id,
            CompanyId: asset.CompanyId,
            SiteId: asset.SiteId,
            SiteName: site?.Name ?? "Unknown",
            Identity: MapIdentity(asset),
            State: MapState(state),
            Identifiers: identifiers.Select(MapIdentifier).ToList(),
            CurrentMetrics: metrics.Select(MapMetric).ToList(),
            RecentEvents: events.Select(MapEvent).ToList());
    }

    private Guid? GetCompanyIdFromQuery(AssetQuery query)
    {
        // O company_id vem do token JWT via filtro
        return null;
    }

    private static IQueryable<Domain.Entities.Asset> ApplyFilters(IQueryable<Domain.Entities.Asset> query, AssetQuery filters)
    {
        if (filters.SiteId.HasValue)
            query = query.Where(a => a.SiteId == filters.SiteId.Value);

        if (!string.IsNullOrEmpty(filters.AssetType))
            query = query.Where(a => a.AssetType == filters.AssetType);

        if (!string.IsNullOrEmpty(filters.Text))
        {
            var text = filters.Text.ToLower();
            query = query.Where(a =>
                a.DisplayName.ToLower().Contains(text) ||
                (a.Hostname != null && a.Hostname.ToLower().Contains(text)) ||
                (a.PrimaryIp != null && a.PrimaryIp.Contains(text)));
        }

        return query;
    }

    private static IQueryable<Domain.Entities.Asset> ApplySorting(IQueryable<Domain.Entities.Asset> query, AssetQuery filters)
    {
        return (filters.SortBy?.ToLower(), filters.SortDescending) switch
        {
            ("name", true) => query.OrderByDescending(a => a.DisplayName),
            ("name", false) => query.OrderBy(a => a.DisplayName),
            ("type", true) => query.OrderByDescending(a => a.AssetType),
            ("type", false) => query.OrderBy(a => a.AssetType),
            ("created", true) => query.OrderByDescending(a => a.CreatedAt),
            ("created", false) => query.OrderBy(a => a.CreatedAt),
            _ => query.OrderByDescending(a => a.LastSeenAt)
        };
    }

    private static AssetSummary MapToSummary(
        Domain.Entities.Asset asset,
        Domain.Entities.AssetCurrentState? state,
        string siteName)
    {
        var tags = asset.Tags != null && asset.Tags.Count > 0
            ? (IReadOnlyList<string>)asset.Tags
            : (IReadOnlyList<string>)Array.Empty<string>();

        return new AssetSummary(
            Id: asset.Id,
            CompanyId: asset.CompanyId,
            SiteId: asset.SiteId,
            SiteName: siteName,
            AssetType: asset.AssetType,
            DisplayName: asset.DisplayName,
            Manufacturer: asset.Manufacturer,
            Model: asset.Model,
            PrimaryIp: asset.PrimaryIp,
            Hostname: asset.Hostname,
            LifecycleStatus: asset.LifecycleStatus,
            HealthStatus: state?.Health.ToString() ?? "Unknown",
            LastSeenAt: state?.LastSuccessAt,
            FreshnessSeconds: state?.FreshnessSeconds,
            LastFailureResult: state?.LastFailureResult,
            Tags: tags,
            CreatedAt: asset.CreatedAt);
    }

    private static AssetIdentity MapIdentity(Domain.Entities.Asset asset)
    {
        var tags = asset.Tags ?? new List<string>();
        return new AssetIdentity(
            AssetType: asset.AssetType,
            DisplayName: asset.DisplayName,
            Manufacturer: asset.Manufacturer,
            Model: asset.Model,
            SerialNumber: asset.SerialNumber,
            PrimaryIp: asset.PrimaryIp,
            PrimaryMac: asset.PrimaryMac,
            Hostname: asset.Hostname,
            Tags: tags,
            PropertiesJson: asset.Properties == "{}" ? null : asset.Properties);
    }

    private static AssetCurrentStateDetail MapState(Domain.Entities.AssetCurrentState? state)
    {
        if (state == null)
        {
            return new AssetCurrentStateDetail(
                HealthStatus: "Unknown",
                LastAttemptAt: null,
                LastSuccessAt: null,
                FreshnessSeconds: null,
                ExpectedIntervalSeconds: 60,
                ConsecutiveFailures: 0,
                LastFailureResult: null,
                LastFailureCode: null,
                ComputedAt: DateTimeOffset.UtcNow,
                StateVersion: 0);
        }

        return new AssetCurrentStateDetail(
            HealthStatus: state.Health.ToString(),
            LastAttemptAt: state.LastAttemptAt,
            LastSuccessAt: state.LastSuccessAt,
            FreshnessSeconds: state.FreshnessSeconds,
            ExpectedIntervalSeconds: state.ExpectedIntervalSeconds,
            ConsecutiveFailures: state.ConsecutiveFailures,
            LastFailureResult: state.LastFailureResult,
            LastFailureCode: state.LastFailureCode,
            ComputedAt: state.ComputedAt,
            StateVersion: state.Version);
    }

    private static AssetIdentifierRecord MapIdentifier(Domain.Entities.AssetIdentifier id)
    {
        return new AssetIdentifierRecord(
            IdentifierType: id.IdentifierType,
            Value: id.NormalizedValue,
            Confidence: id.Confidence.ToString(),
            Status: id.Status.ToString(),
            FirstSeenAt: id.FirstSeenAt,
            LastSeenAt: id.LastSeenAt);
    }

    private static MetricSnapshot MapMetric(Domain.Entities.AssetMetricCurrent m)
    {
        double? value = m.ValueDouble ?? m.ValueLong;
        if (m.ValueBoolean.HasValue)
            value = m.ValueBoolean.Value ? 1 : 0;

        return new MetricSnapshot(
            MetricKey: m.MetricId.ToString(),
            DisplayName: m.MetricId.ToString(),
            Unit: null,
            Value: value,
            Quality: m.Quality,
            CollectedAt: m.CollectedAt);
    }

    private static EventResponse MapEvent(Domain.Entities.MonitoringEvent e)
    {
        return new EventResponse(
            Id: e.Id,
            CompanyId: e.CompanyId,
            SiteId: e.SiteId,
            SiteName: null,
            AssetId: e.AssetId,
            AssetName: null,
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

    private static string EncodeCursor(DateTimeOffset lastSeen, Guid id)
    {
        return $"{lastSeen:O}|{id}";
    }

    private static (DateTimeOffset LastSeen, Guid Id) DecodeCursor(string cursor)
    {
        var parts = cursor.Split('|');
        return (
            DateTimeOffset.Parse(parts[0]),
            Guid.Parse(parts[1]));
    }
}
