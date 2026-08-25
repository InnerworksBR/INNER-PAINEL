namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Evento de stream em tempo real.
/// </summary>
public sealed class StreamEvent
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? SiteId { get; private set; }
    public Guid? AssetId { get; private set; }
    public Guid? SourceId { get; private set; }
    public string StreamType { get; private set; } = string.Empty; // metrics, events, state_changes
    public string EventKind { get; private set; } = string.Empty; // metric_sample, alert, state_transition
    public DateTimeOffset Timestamp { get; private set; }
    public string Payload { get; private set; } = "{}";
    public DateTimeOffset ReceivedAt { get; private set; }
    public DateTimeOffset PartitionDate { get; private set; }

    private StreamEvent() { }

    public static StreamEvent Create(
        Guid companyId,
        string streamType,
        string eventKind,
        DateTimeOffset timestamp,
        string payload,
        Guid? siteId = null,
        Guid? assetId = null,
        Guid? sourceId = null)
    {
        var now = DateTimeOffset.UtcNow;
        return new StreamEvent
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SiteId = siteId,
            AssetId = assetId,
            SourceId = sourceId,
            StreamType = streamType,
            EventKind = eventKind,
            Timestamp = timestamp,
            Payload = payload,
            ReceivedAt = now,
            PartitionDate = timestamp.Date
        };
    }
}
