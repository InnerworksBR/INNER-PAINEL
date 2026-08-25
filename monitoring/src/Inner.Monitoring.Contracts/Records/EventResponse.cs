using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Resposta paginada para listagem de eventos.
/// </summary>
public sealed record EventListResponse(
    IReadOnlyList<EventResponse> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages,
    string? NextCursor);

/// <summary>
/// Resposta de um evento.
/// </summary>
public sealed record EventResponse(
    Guid Id,
    Guid CompanyId,
    Guid? SiteId,
    string? SiteName,
    Guid? AssetId,
    string? AssetName,
    Guid? SourceId,
    string EventType,
    EventSeverity Severity,
    string Title,
    string Message,
    string EventKey,
    EventState State,
    DateTimeOffset OccurredAt,
    DateTimeOffset? ResolvedAt,
    string? PayloadJson,
    DateTimeOffset CreatedAt);
