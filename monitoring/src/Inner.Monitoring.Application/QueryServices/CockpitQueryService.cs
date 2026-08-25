using System.Text.Json;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Interfaces;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Application.QueryServices;

/// <summary>
/// Implementação do serviço de query para cockpit.
/// </summary>
public class CockpitQueryService : ICockpitQueryService
{
    private readonly MonitoringDbContext _db;

    public CockpitQueryService(MonitoringDbContext db)
    {
        _db = db;
    }

    public async Task<CockpitResponse> GetCockpitAsync(Guid companyId, CancellationToken ct = default)
    {
        var now = DateTimeOffset.UtcNow;
        var yesterday = now.AddDays(-1);

        // Assets por estado
        var assetsByState = await GetAssetsByStateAsync(companyId, ct);

        // Sources por status
        var sourcesByState = await GetSourcesByStateAsync(companyId, ct);

        // Eventos recentes
        var recentEvents = await GetRecentEventsAsync(companyId, yesterday, ct);

        // Alertas ativos
        var activeAlerts = await GetActiveAlertsAsync(companyId, yesterday, ct);

        // Cobertura de sites
        var coverage = await GetSiteCoverageAsync(companyId, ct);

        return new CockpitResponse(
            CompanyId: companyId,
            Timestamp: now,
            AssetsByState: assetsByState,
            SourcesByState: sourcesByState,
            RecentEvents: recentEvents,
            ActiveAlerts: activeAlerts,
            Coverage: coverage);
    }

    private async Task<AssetSummaryByState> GetAssetsByStateAsync(Guid companyId, CancellationToken ct)
    {
        var states = await _db.AssetCurrentStates
            .Where(s => s.CompanyId == companyId)
            .GroupBy(s => s.Health)
            .Select(g => new { Health = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var total = states.Sum(s => s.Count);
        var dict = states.ToDictionary(s => s.Health, s => s.Count);

        return new AssetSummaryByState(
            Total: total,
            Healthy: dict.GetValueOrDefault(HealthStatus.Healthy),
            Warning: dict.GetValueOrDefault(HealthStatus.Warning),
            Stale: dict.GetValueOrDefault(HealthStatus.Stale),
            Offline: dict.GetValueOrDefault(HealthStatus.Offline),
            Unknown: dict.GetValueOrDefault(HealthStatus.Unknown),
            Maintenance: dict.GetValueOrDefault(HealthStatus.Maintenance));
    }

    private async Task<SourceSummaryByState> GetSourcesByStateAsync(Guid companyId, CancellationToken ct)
    {
        var statuses = await _db.Sources
            .Where(s => s.CompanyId == companyId && s.DeletedAt == null)
            .GroupBy(s => s.Status)
            .Select(g => new { Status = g.Key, Count = g.Count() })
            .ToListAsync(ct);

        var total = statuses.Sum(s => s.Count);
        var dict = statuses.ToDictionary(s => s.Status, s => s.Count);

        return new SourceSummaryByState(
            Total: total,
            Online: dict.GetValueOrDefault(SourceStatus.Online),
            Degraded: dict.GetValueOrDefault(SourceStatus.Degraded),
            Offline: dict.GetValueOrDefault(SourceStatus.Offline),
            Pending: dict.GetValueOrDefault(SourceStatus.Pending),
            Upgrading: dict.GetValueOrDefault(SourceStatus.Upgrading));
    }

    private async Task<EventSummary> GetRecentEventsAsync(Guid companyId, DateTimeOffset since, CancellationToken ct)
    {
        var events = await _db.MonitoringEvents
            .Where(e => e.CompanyId == companyId && e.OccurredAt >= since)
            .ToListAsync(ct);

        var recentList = events
            .OrderByDescending(e => e.OccurredAt)
            .Take(10)
            .Select(MapEvent)
            .ToList();

        return new EventSummary(
            TotalLast24h: events.Count,
            CriticalLast24h: events.Count(e => e.Severity == EventSeverity.Critical),
            WarningLast24h: events.Count(e => e.Severity == EventSeverity.Warning),
            InfoLast24h: events.Count(e => e.Severity == EventSeverity.Info),
            Recent: recentList);
    }

    private async Task<AlertSummary> GetActiveAlertsAsync(Guid companyId, DateTimeOffset since, CancellationToken ct)
    {
        var activeEvents = await _db.MonitoringEvents
            .Where(e => e.CompanyId == companyId && e.OccurredAt >= since)
            .Where(e => e.State == EventState.Open || e.State == EventState.Acknowledged)
            .ToListAsync(ct);

        return new AlertSummary(
            TotalActive: activeEvents.Count,
            Critical: activeEvents.Count(e => e.Severity == EventSeverity.Critical && e.State == EventState.Open),
            Warning: activeEvents.Count(e => e.Severity == EventSeverity.Warning && e.State == EventState.Open),
            Info: activeEvents.Count(e => e.Severity == EventSeverity.Info && e.State == EventState.Open),
            Unacknowledged: activeEvents.Count(e => e.State == EventState.Open));
    }

    private async Task<SiteCoverage> GetSiteCoverageAsync(Guid companyId, CancellationToken ct)
    {
        var sites = await _db.Sites
            .Where(s => s.CompanyId == companyId && s.DeletedAt == null)
            .CountAsync(ct);

        var monitoredSites = await _db.Assets
            .Where(a => a.CompanyId == companyId && a.DeletedAt == null)
            .Select(a => a.SiteId)
            .Distinct()
            .CountAsync(ct);

        var now = DateTimeOffset.UtcNow;
        var staleThreshold = now.AddMinutes(-15);

        var assetsWithData = await _db.AssetCurrentStates
            .Where(s => s.CompanyId == companyId)
            .Where(s => s.LastSuccessAt >= staleThreshold)
            .CountAsync(ct);

        var assetsStale = await _db.AssetCurrentStates
            .Where(s => s.CompanyId == companyId)
            .Where(s => s.LastSuccessAt < staleThreshold || s.LastSuccessAt == null)
            .CountAsync(ct);

        var sourcesActive = await _db.Sources
            .Where(s => s.CompanyId == companyId && s.DeletedAt == null)
            .Where(s => s.Status == SourceStatus.Online || s.Status == SourceStatus.Degraded)
            .CountAsync(ct);

        return new SiteCoverage(
            TotalSites: sites,
            MonitoredSites: monitoredSites,
            AssetsWithData: assetsWithData,
            AssetsStale: assetsStale,
            SourcesActive: sourcesActive);
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
}
