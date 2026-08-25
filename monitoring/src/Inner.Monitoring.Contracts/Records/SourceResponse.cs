using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Resposta para listagem de sources.
/// </summary>
public sealed record SourceListResponse(
    IReadOnlyList<SourceResponse> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    string? NextCursor);

/// <summary>
/// Resumo de uma source.
/// </summary>
public sealed record SourceResponse(
    Guid Id,
    Guid CompanyId,
    Guid SiteId,
    string SiteName,
    SourceType SourceType,
    string DisplayName,
    SourceStatus Status,
    string Platform,
    string Architecture,
    string? CurrentVersion,
    string? DesiredVersion,
    string? MinimumVersion,
    string VersionStatus,
    long ConfigVersion,
    int HeartbeatIntervalSeconds,
    DateTimeOffset? LastHeartbeatAt,
    DateTimeOffset? LastIngestAt,
    string? LastIp,
    int? ClockSkewSeconds,
    SourceCapabilities Capabilities,
    DateTimeOffset CreatedAt);

/// <summary>
/// Resumo de health da source.
/// </summary>
public sealed record SourceHealthSummary(
    string Status,
    IReadOnlyList<string> Warnings,
    SourceCollectionStatus Collection);

/// <summary>
/// Status de coleta de uma source.
/// </summary>
public sealed record SourceCollectionStatus(
    DateTimeOffset? LastCycleStartedAt,
    DateTimeOffset? LastCycleCompletedAt,
    string? LastCycleResult,
    string? LastErrorCode);
