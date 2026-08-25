using System.Text.Json;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Application.QueryServices;

/// <summary>
/// Implementação do serviço de query para sources.
/// </summary>
public class SourceQueryService : ISourceQueryService
{
    private readonly MonitoringDbContext _db;

    public SourceQueryService(MonitoringDbContext db)
    {
        _db = db;
    }

    public async Task<PagedResult<SourceResponse>> ListSourcesAsync(Guid companyId, SourceQuery query, CancellationToken ct = default)
    {
        var baseQuery = _db.Sources
            .Where(s => s.CompanyId == companyId && s.DeletedAt == null);

        // Aplicar filtros
        var filteredQuery = ApplyFilters(baseQuery, query);

        // Total
        var totalItems = await filteredQuery.CountAsync(ct);

        // Ordenação
        var orderedQuery = ApplySorting(filteredQuery, query);

        // Cursor ou paginação
        IQueryable<Domain.Entities.Source> pagedQuery;
        string? nextCursor = null;

        if (!string.IsNullOrEmpty(query.Cursor))
        {
            var cursor = DecodeCursor(query.Cursor);
            pagedQuery = orderedQuery.Where(s => s.LastHeartbeatAt < cursor.LastHeartbeat || s.Id.CompareTo(cursor.Id) < 0);
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
            nextCursor = EncodeCursor(last.LastHeartbeatAt, last.Id);
        }

        // Carregar sites
        var siteIds = items.Select(s => s.SiteId).Distinct().ToList();
        var sites = await _db.Sites
            .Where(s => siteIds.Contains(s.Id))
            .ToDictionaryAsync(s => s.Id, s => s.Name, ct);

        var result = items.Select(s =>
        {
            sites.TryGetValue(s.SiteId, out var siteName);
            return MapToResponse(s, siteName ?? "Unknown");
        }).ToList();

        var totalPages = (int)Math.Ceiling((double)totalItems / query.PageSize);

        return new PagedResult<SourceResponse>(
            Items: result,
            Page: query.Page,
            PageSize: query.PageSize,
            TotalItems: totalItems,
            TotalPages: totalPages,
            NextCursor: nextCursor);
    }

    private static IQueryable<Domain.Entities.Source> ApplyFilters(IQueryable<Domain.Entities.Source> query, SourceQuery filters)
    {
        if (filters.SiteId.HasValue)
            query = query.Where(s => s.SiteId == filters.SiteId.Value);

        if (!string.IsNullOrEmpty(filters.SourceType))
        {
            if (Enum.TryParse<SourceType>(filters.SourceType, true, out var st))
                query = query.Where(s => s.SourceType == st);
        }

        if (!string.IsNullOrEmpty(filters.Status))
        {
            if (Enum.TryParse<SourceStatus>(filters.Status, true, out var ss))
                query = query.Where(s => s.Status == ss);
        }

        if (!string.IsNullOrEmpty(filters.Text))
        {
            var text = filters.Text.ToLower();
            query = query.Where(s =>
                s.DisplayName.ToLower().Contains(text) ||
                s.Platform.ToLower().Contains(text));
        }

        return query;
    }

    private static IQueryable<Domain.Entities.Source> ApplySorting(IQueryable<Domain.Entities.Source> query, SourceQuery filters)
    {
        return (filters.SortBy?.ToLower(), filters.SortDescending) switch
        {
            ("name", true) => query.OrderByDescending(s => s.DisplayName),
            ("name", false) => query.OrderBy(s => s.DisplayName),
            ("type", true) => query.OrderByDescending(s => s.SourceType),
            ("type", false) => query.OrderBy(s => s.SourceType),
            ("created", true) => query.OrderByDescending(s => s.CreatedAt),
            ("created", false) => query.OrderBy(s => s.CreatedAt),
            _ => query.OrderByDescending(s => s.LastHeartbeatAt)
        };
    }

    private static SourceResponse MapToResponse(Domain.Entities.Source source, string siteName)
    {
        var capabilities = ParseCapabilities(source.CapabilitiesJson);

        return new SourceResponse(
            Id: source.Id,
            CompanyId: source.CompanyId,
            SiteId: source.SiteId,
            SiteName: siteName,
            SourceType: source.SourceType,
            DisplayName: source.DisplayName,
            Status: source.Status,
            Platform: source.Platform,
            Architecture: source.Architecture,
            CurrentVersion: source.CurrentVersion,
            DesiredVersion: source.DesiredVersion,
            MinimumVersion: source.MinimumVersion,
            VersionStatus: DetermineVersionStatus(source),
            ConfigVersion: source.ConfigVersion,
            HeartbeatIntervalSeconds: source.HeartbeatIntervalSeconds,
            LastHeartbeatAt: source.LastHeartbeatAt,
            LastIngestAt: source.LastIngestAt,
            LastIp: source.LastIp,
            ClockSkewSeconds: source.ClockSkewSeconds,
            Capabilities: capabilities,
            CreatedAt: source.CreatedAt);
    }

    private static SourceCapabilities ParseCapabilities(string json)
    {
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            return new SourceCapabilities(
                HostMetrics: root.TryGetProperty("hostMetrics", out var hm) && hm.GetBoolean(),
                HyperV: root.TryGetProperty("hyperv", out var hv) && hv.GetBoolean(),
                SnmpV2c: root.TryGetProperty("snmpV2c", out var snmp2) && snmp2.GetBoolean(),
                SnmpV3: root.TryGetProperty("snmpV3", out var snmp3) && snmp3.GetBoolean());
        }
        catch
        {
            return new SourceCapabilities(false, false, false, false);
        }
    }

    private static string DetermineVersionStatus(Domain.Entities.Source source)
    {
        if (!string.IsNullOrEmpty(source.MinimumVersion) &&
            CompareVersions(source.CurrentVersion, source.MinimumVersion) < 0)
        {
            return "outdated";
        }

        if (!string.IsNullOrEmpty(source.DesiredVersion) &&
            CompareVersions(source.CurrentVersion, source.DesiredVersion) < 0)
        {
            return "upgrade_available";
        }

        return "current";
    }

    private static int CompareVersions(string current, string? required)
    {
        if (string.IsNullOrEmpty(required)) return 0;

        var currentParts = current.Split('.').Select(int.Parse).ToArray();
        var requiredParts = required.Split('.').Select(int.Parse).ToArray();

        for (int i = 0; i < Math.Max(currentParts.Length, requiredParts.Length); i++)
        {
            var c = i < currentParts.Length ? currentParts[i] : 0;
            var r = i < requiredParts.Length ? requiredParts[i] : 0;
            if (c != r) return c.CompareTo(r);
        }

        return 0;
    }

    private static string EncodeCursor(DateTimeOffset? lastHeartbeat, Guid id)
    {
        return $"{lastHeartbeat:O}|{id}";
    }

    private static (DateTimeOffset? LastHeartbeat, Guid Id) DecodeCursor(string cursor)
    {
        var parts = cursor.Split('|');
        return (
            string.IsNullOrEmpty(parts[0]) ? null : DateTimeOffset.Parse(parts[0]),
            Guid.Parse(parts[1]));
    }
}
