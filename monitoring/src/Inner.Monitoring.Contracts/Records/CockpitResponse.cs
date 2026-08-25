namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Resumo do cockpit para dashboard operacional.
/// </summary>
public sealed record CockpitResponse(
    Guid CompanyId,
    DateTimeOffset Timestamp,
    AssetSummaryByState AssetsByState,
    SourceSummaryByState SourcesByState,
    EventSummary RecentEvents,
    AlertSummary ActiveAlerts,
    SiteCoverage Coverage);

/// <summary>
/// Resumo de assets por estado de saúde.
/// </summary>
public sealed record AssetSummaryByState(
    int Total,
    int Healthy,
    int Warning,
    int Stale,
    int Offline,
    int Unknown,
    int Maintenance);

/// <summary>
/// Resumo de sources por status.
/// </summary>
public sealed record SourceSummaryByState(
    int Total,
    int Online,
    int Degraded,
    int Offline,
    int Pending,
    int Upgrading);

/// <summary>
/// Resumo de eventos recentes.
/// </summary>
public sealed record EventSummary(
    int TotalLast24h,
    int CriticalLast24h,
    int WarningLast24h,
    int InfoLast24h,
    IReadOnlyList<EventResponse> Recent);

/// <summary>
/// Resumo de alertas ativos.
/// </summary>
public sealed record AlertSummary(
    int TotalActive,
    int Critical,
    int Warning,
    int Info,
    int Unacknowledged);

/// <summary>
/// Cobertura de sites.
/// </summary>
public sealed record SiteCoverage(
    int TotalSites,
    int MonitoredSites,
    int AssetsWithData,
    int AssetsStale,
    int SourcesActive);
