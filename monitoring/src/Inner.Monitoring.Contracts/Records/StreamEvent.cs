namespace Inner.Monitoring.Contracts.Records;

/// <summary>
/// Evento SSE para stream em tempo real.
/// </summary>
public sealed record StreamEvent(
    string EventType,
    Guid EventId,
    Guid CompanyId,
    Guid? SiteId,
    Guid? AssetId,
    Guid? SourceId,
    DateTimeOffset Timestamp,
    StreamEventPayload Payload);

/// <summary>
/// Payload do evento de stream.
/// </summary>
public sealed record StreamEventPayload(
    string? AssetState,
    string? PreviousAssetState,
    string? SourceStatus,
    string? PreviousSourceStatus,
    MetricUpdate? Metrics,
    EventResponse? Event);

/// <summary>
/// Atualização de métricas.
/// </summary>
public sealed record MetricUpdate(
    Guid AssetId,
    IReadOnlyList<MetricSnapshot> UpdatedMetrics);

/// <summary>
/// Tipos de eventos SSE.
/// </summary>
public static class StreamEventTypes
{
    public const string AssetStateChanged = "asset_state_changed";
    public const string SourceStatusChanged = "source_status_changed";
    public const string NewEvent = "new_event";
    public const string MetricsUpdated = "metrics_updated";
}

/// <summary>
/// Cursor para reconnect do SSE.
/// </summary>
public sealed record StreamCursor(
    long Sequence,
    DateTimeOffset Timestamp);
