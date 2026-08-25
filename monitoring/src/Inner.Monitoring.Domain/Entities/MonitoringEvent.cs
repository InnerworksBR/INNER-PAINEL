using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Evento de monitoramento (mudança de estado, alertas, etc).
/// </summary>
public sealed class MonitoringEvent
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? SiteId { get; private set; }
    public Guid? AssetId { get; private set; }
    public Guid? SourceId { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public EventSeverity Severity { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string Message { get; private set; } = string.Empty;
    public string EventKey { get; private set; } = string.Empty;
    public EventState State { get; private set; } = EventState.Open;
    public DateTimeOffset OccurredAt { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }
    public string Payload { get; private set; } = "{}";
    public DateTimeOffset CreatedAt { get; private set; }

    private MonitoringEvent() { }

    public static MonitoringEvent Create(
        Guid companyId,
        string eventType,
        EventSeverity severity,
        string title,
        string message,
        string eventKey,
        Guid? siteId = null,
        Guid? assetId = null,
        Guid? sourceId = null,
        string? payload = null)
    {
        return new MonitoringEvent
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            AssetId = assetId,
            SourceId = sourceId,
            EventType = eventType,
            Severity = severity,
            Title = title,
            Message = message,
            EventKey = eventKey,
            State = EventState.Open,
            OccurredAt = DateTimeOffset.UtcNow,
            Payload = payload ?? "{}",
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Acknowledge()
    {
        State = EventState.Acknowledged;
    }

    public void Resolve()
    {
        State = EventState.Resolved;
        ResolvedAt = DateTimeOffset.UtcNow;
    }
}
