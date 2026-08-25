using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Repositório de Ingest Batches.
/// </summary>
public class IngestBatchRepository : IIngestBatchRepository
{
    private readonly MonitoringDbContext _context;

    public IngestBatchRepository(MonitoringDbContext context)
    {
        _context = context;
    }

    public async Task<IngestBatch?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
    }

    public async Task<IngestBatch?> GetByBatchIdAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .FirstOrDefaultAsync(b => b.BatchId == batchId, cancellationToken);
    }

    public async Task<IngestBatch?> GetBySourceAndSequenceAsync(Guid sourceId, long sequence, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .FirstOrDefaultAsync(b => b.SourceId == sourceId && b.Sequence == sequence, cancellationToken);
    }

    public async Task<IReadOnlyList<IngestBatch>> GetBySourceIdAsync(Guid sourceId, int limit = 100, int offset = 0, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .Where(b => b.SourceId == sourceId)
            .OrderByDescending(b => b.ReceivedAt)
            .Skip(offset)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<IngestBatch>> GetPendingBatchesAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .Where(b => b.CompanyId == companyId && b.Status == Contracts.Enums.BatchStatus.Received)
            .OrderBy(b => b.ReceivedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<IngestBatch>> GetDeadLetterBatchesAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default)
    {
        return await _context.IngestBatches
            .Where(b => b.CompanyId == companyId && b.Status == Contracts.Enums.BatchStatus.DeadLetter)
            .OrderByDescending(b => b.ReceivedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(IngestBatch batch, CancellationToken cancellationToken = default)
    {
        await _context.IngestBatches.AddAsync(batch, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(IngestBatch batch, CancellationToken cancellationToken = default)
    {
        _context.IngestBatches.Update(batch);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Sequence Gaps
    public async Task<SourceSequenceGap?> GetSequenceGapAsync(Guid sourceId, long startSequence, CancellationToken cancellationToken = default)
    {
        return await _context.SourceSequenceGaps
            .FirstOrDefaultAsync(g => g.SourceId == sourceId && g.GapStartSequence == startSequence, cancellationToken);
    }

    public async Task<IReadOnlyList<SourceSequenceGap>> GetOpenGapsAsync(Guid sourceId, CancellationToken cancellationToken = default)
    {
        return await _context.SourceSequenceGaps
            .Where(g => g.SourceId == sourceId && g.Status == "open")
            .OrderBy(g => g.GapStartSequence)
            .ToListAsync(cancellationToken);
    }

    public async Task AddSequenceGapAsync(SourceSequenceGap gap, CancellationToken cancellationToken = default)
    {
        await _context.SourceSequenceGaps.AddAsync(gap, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateSequenceGapAsync(SourceSequenceGap gap, CancellationToken cancellationToken = default)
    {
        _context.SourceSequenceGaps.Update(gap);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Collection Attempts
    public async Task AddCollectionAttemptAsync(CollectionAttempt attempt, CancellationToken cancellationToken = default)
    {
        await _context.CollectionAttempts.AddAsync(attempt, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<CollectionAttempt>> GetCollectionAttemptsBySourceAsync(Guid sourceId, DateTimeOffset since, int limit = 1000, CancellationToken cancellationToken = default)
    {
        return await _context.CollectionAttempts
            .Where(a => a.SourceId == sourceId && a.StartedAt >= since)
            .OrderByDescending(a => a.StartedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<Dictionary<string, int>> GetCollectionAttemptStatsAsync(Guid sourceId, DateTimeOffset since, CancellationToken cancellationToken = default)
    {
        return await _context.CollectionAttempts
            .Where(a => a.SourceId == sourceId && a.StartedAt >= since)
            .GroupBy(a => a.Result)
            .Select(g => new { Result = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.Result, x => x.Count, cancellationToken);
    }
}
