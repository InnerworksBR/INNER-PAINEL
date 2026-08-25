namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Cursor de sequência para tracking de batches.
/// </summary>
public sealed class SourceSequenceCursor
{
    public Guid SourceId { get; private set; }
    public long HighestReceivedSequence { get; private set; }
    public long HighestContiguousSequence { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    // Construtor para EF Core
    private SourceSequenceCursor() { }

    /// <summary>
    ///     Cria um novo cursor de sequência.
    /// </summary>
    public static SourceSequenceCursor Create(Guid sourceId)
    {
        var now = DateTimeOffset.UtcNow;
        return new SourceSequenceCursor
        {
            SourceId = sourceId,
            HighestReceivedSequence = 0,
            HighestContiguousSequence = 0,
            UpdatedAt = now
        };
    }

    public void UpdateReceived(long sequence)
    {
        if (sequence > HighestReceivedSequence)
        {
            HighestReceivedSequence = sequence;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    public void UpdateContiguous(long sequence)
    {
        if (sequence > HighestContiguousSequence)
        {
            HighestContiguousSequence = sequence;
            UpdatedAt = DateTimeOffset.UtcNow;
        }
    }

    /// <summary>
    ///     Atualiza cursor a partir de dados lidos do banco.
    /// </summary>
    public static SourceSequenceCursor FromData(
        Guid sourceId,
        long highestReceived,
        long highestContiguous,
        DateTimeOffset updatedAt)
    {
        return new SourceSequenceCursor
        {
            SourceId = sourceId,
            HighestReceivedSequence = highestReceived,
            HighestContiguousSequence = highestContiguous,
            UpdatedAt = updatedAt
        };
    }
}
