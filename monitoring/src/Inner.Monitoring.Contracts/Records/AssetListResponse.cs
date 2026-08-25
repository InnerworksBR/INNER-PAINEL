namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Resposta paginada para listagem de assets.
/// </summary>
public sealed record AssetListResponse(
    IReadOnlyList<AssetSummary> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    string? NextCursor);

/// <summary>
/// Resumo de um asset para listagem.
/// </summary>
public sealed record AssetSummary(
    Guid Id,
    Guid CompanyId,
    Guid SiteId,
    string SiteName,
    string AssetType,
    string DisplayName,
    string? Manufacturer,
    string? Model,
    string? PrimaryIp,
    string? Hostname,
    string LifecycleStatus,
    string HealthStatus,
    DateTimeOffset? LastSeenAt,
    int? FreshnessSeconds,
    string? LastFailureResult,
    IReadOnlyList<string> Tags,
    DateTimeOffset CreatedAt);

/// <summary>
/// Resposta detalhada de um asset.
/// </summary>
public sealed record AssetDetailResponse(
    Guid Id,
    Guid CompanyId,
    Guid SiteId,
    string SiteName,
    AssetIdentity Identity,
    AssetCurrentStateDetail State,
    IReadOnlyList<AssetIdentifierRecord> Identifiers,
    IReadOnlyList<MetricSnapshot> CurrentMetrics,
    IReadOnlyList<EventResponse> RecentEvents);

/// <summary>
/// Identidade do asset.
/// </summary>
public sealed record AssetIdentity(
    string AssetType,
    string DisplayName,
    string? Manufacturer,
    string? Model,
    string? SerialNumber,
    string? PrimaryIp,
    string? PrimaryMac,
    string? Hostname,
    IReadOnlyList<string> Tags,
    string? PropertiesJson);

/// <summary>
/// Estado atual detalhado.
/// </summary>
public sealed record AssetCurrentStateDetail(
    string HealthStatus,
    DateTimeOffset? LastAttemptAt,
    DateTimeOffset? LastSuccessAt,
    int? FreshnessSeconds,
    int ExpectedIntervalSeconds,
    int ConsecutiveFailures,
    string? LastFailureResult,
    string? LastFailureCode,
    DateTimeOffset ComputedAt,
    long StateVersion);

/// <summary>
/// Identificador do asset.
/// </summary>
public sealed record AssetIdentifierRecord(
    string IdentifierType,
    string Value,
    string Confidence,
    string Status,
    DateTimeOffset FirstSeenAt,
    DateTimeOffset LastSeenAt);

/// <summary>
/// Snapshot de métrica atual.
/// </summary>
public sealed record MetricSnapshot(
    string MetricKey,
    string DisplayName,
    string? Unit,
    double? Value,
    string? Quality,
    DateTimeOffset CollectedAt);
