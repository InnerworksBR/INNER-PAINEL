using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Interface para repositório de Ingest Batches.
/// </summary>
public interface IIngestBatchRepository
{
    Task<IngestBatch?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IngestBatch?> GetByBatchIdAsync(Guid batchId, CancellationToken cancellationToken = default);
    Task<IngestBatch?> GetBySourceAndSequenceAsync(Guid sourceId, long sequence, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<IngestBatch>> GetBySourceIdAsync(Guid sourceId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<IngestBatch>> GetPendingBatchesAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<IngestBatch>> GetDeadLetterBatchesAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default);
    Task AddAsync(IngestBatch batch, CancellationToken cancellationToken = default);
    Task UpdateAsync(IngestBatch batch, CancellationToken cancellationToken = default);

    // Sequence Gaps
    Task<SourceSequenceGap?> GetSequenceGapAsync(Guid sourceId, long startSequence, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<SourceSequenceGap>> GetOpenGapsAsync(Guid sourceId, CancellationToken cancellationToken = default);
    Task AddSequenceGapAsync(SourceSequenceGap gap, CancellationToken cancellationToken = default);
    Task UpdateSequenceGapAsync(SourceSequenceGap gap, CancellationToken cancellationToken = default);

    // Collection Attempts (for collectors)
    Task AddCollectionAttemptAsync(CollectionAttempt attempt, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<CollectionAttempt>> GetCollectionAttemptsBySourceAsync(Guid sourceId, DateTimeOffset since, int limit = 1000, CancellationToken cancellationToken = default);
    Task<Dictionary<string, int>> GetCollectionAttemptStatsAsync(Guid sourceId, DateTimeOffset since, CancellationToken cancellationToken = default);
}
