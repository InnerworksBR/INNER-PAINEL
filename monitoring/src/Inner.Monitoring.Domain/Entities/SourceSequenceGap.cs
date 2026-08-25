namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Gap de sequência detectado em uma source.
/// </summary>
public sealed class SourceSequenceGap
{
    public Guid Id { get; private set; }
    public Guid SourceId { get; private set; }
    public Guid CompanyId { get; private set; }
    public long GapStartSequence { get; private set; }
    public long GapEndSequence { get; private set; }
    public int MissingCount { get; private set; }
    public string Status { get; private set; } = "open"; // open, filled, abandoned
    public DateTimeOffset? FilledAt { get; private set; }
    public DateTimeOffset DetectedAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }

    private SourceSequenceGap() { }

    public static SourceSequenceGap Create(
        Guid sourceId,
        Guid companyId,
        long gapStartSequence,
        long gapEndSequence)
    {
        var now = DateTimeOffset.UtcNow;
        return new SourceSequenceGap
        {
            Id = Guid.NewGuid(),
            SourceId = sourceId,
            CompanyId = companyId,
            GapStartSequence = gapStartSequence,
            GapEndSequence = gapEndSequence,
            MissingCount = (int)(gapEndSequence - gapStartSequence + 1),
            Status = "open",
            DetectedAt = now,
            CreatedAt = now
        };
    }

    public void MarkFilled()
    {
        Status = "filled";
        FilledAt = DateTimeOffset.UtcNow;
    }

    public void MarkAbandoned()
    {
        Status = "abandoned";
    }
}
