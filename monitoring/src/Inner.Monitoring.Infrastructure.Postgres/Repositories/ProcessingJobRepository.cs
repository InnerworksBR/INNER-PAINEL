using Inner.Monitoring.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Repositório de Processing Jobs.
/// </summary>
public class ProcessingJobRepository : IProcessingJobRepository
{
    private readonly MonitoringDbContext _context;

    public ProcessingJobRepository(MonitoringDbContext context)
    {
        _context = context;
    }

    public async Task<ProcessingJob?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await _context.ProcessingJobs
            .FirstOrDefaultAsync(j => j.Id == id, cancellationToken);
    }

    public async Task<ProcessingJob?> GetNextAvailableAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await _context.ProcessingJobs
            .Where(j => (j.Status == Contracts.Enums.JobStatus.Pending || j.Status == Contracts.Enums.JobStatus.Retrying)
                        && j.AvailableAt <= now
                        && (j.LeaseExpiresAt == null || j.LeaseExpiresAt <= now))
            .OrderBy(j => j.Priority)
            .ThenBy(j => j.AvailableAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<ProcessingJob?> GetNextAvailableForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        return await _context.ProcessingJobs
            .Where(j => j.CompanyId == companyId
                        && (j.Status == Contracts.Enums.JobStatus.Pending || j.Status == Contracts.Enums.JobStatus.Retrying)
                        && j.AvailableAt <= now
                        && (j.LeaseExpiresAt == null || j.LeaseExpiresAt <= now))
            .OrderBy(j => j.Priority)
            .ThenBy(j => j.AvailableAt)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProcessingJob>> GetByBatchIdAsync(Guid batchRowId, CancellationToken cancellationToken = default)
    {
        return await _context.ProcessingJobs
            .Where(j => j.BatchRowId == batchRowId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProcessingJob>> GetStaleJobsAsync(TimeSpan staleDuration, int limit = 100, CancellationToken cancellationToken = default)
    {
        var staleThreshold = DateTimeOffset.UtcNow - staleDuration;
        return await _context.ProcessingJobs
            .Where(j => j.Status == Contracts.Enums.JobStatus.Leased
                        && j.LeaseExpiresAt != null
                        && j.LeaseExpiresAt < staleThreshold)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<ProcessingJob>> GetDeadLetterJobsAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default)
    {
        return await _context.ProcessingJobs
            .Where(j => j.CompanyId == companyId && j.Status == Contracts.Enums.JobStatus.DeadLetter)
            .OrderByDescending(j => j.CreatedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(ProcessingJob job, CancellationToken cancellationToken = default)
    {
        await _context.ProcessingJobs.AddAsync(job, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(ProcessingJob job, CancellationToken cancellationToken = default)
    {
        _context.ProcessingJobs.Update(job);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddRangeAsync(IEnumerable<ProcessingJob> jobs, CancellationToken cancellationToken = default)
    {
        await _context.ProcessingJobs.AddRangeAsync(jobs, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Metric Definitions
    public async Task<MetricDefinition?> GetMetricDefinitionByKeyAsync(string metricKey, CancellationToken cancellationToken = default)
    {
        return await _context.MetricDefinitions
            .FirstOrDefaultAsync(m => m.MetricKey == metricKey && m.Active, cancellationToken);
    }

    public async Task<MetricDefinition?> GetMetricDefinitionByIdAsync(int id, CancellationToken cancellationToken = default)
    {
        return await _context.MetricDefinitions
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<MetricDefinition>> GetAllActiveMetricDefinitionsAsync(CancellationToken cancellationToken = default)
    {
        return await _context.MetricDefinitions
            .Where(m => m.Active)
            .OrderBy(m => m.MetricKey)
            .ToListAsync(cancellationToken);
    }

    public async Task AddMetricDefinitionAsync(MetricDefinition definition, CancellationToken cancellationToken = default)
    {
        await _context.MetricDefinitions.AddAsync(definition, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateMetricDefinitionAsync(MetricDefinition definition, CancellationToken cancellationToken = default)
    {
        _context.MetricDefinitions.Update(definition);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Metric Samples
    public async Task AddMetricSampleAsync(MetricSample sample, CancellationToken cancellationToken = default)
    {
        await _context.MetricSamples.AddAsync(sample, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddMetricSamplesAsync(IEnumerable<MetricSample> samples, CancellationToken cancellationToken = default)
    {
        await _context.MetricSamples.AddRangeAsync(samples, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Metric Rollups
    public async Task AddMetricRollup5mAsync(MetricRollup5m rollup, CancellationToken cancellationToken = default)
    {
        await _context.MetricRollups5m.AddAsync(rollup, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task AddMetricRollup1hAsync(MetricRollup1h rollup, CancellationToken cancellationToken = default)
    {
        await _context.MetricRollups1h.AddAsync(rollup, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    // Asset Metric Current
    public async Task UpsertAssetMetricCurrentsAsync(IEnumerable<AssetMetricCurrent> metrics, CancellationToken cancellationToken = default)
    {
        foreach (var metric in metrics)
        {
            var existing = await _context.AssetMetricCurrents
                .FirstOrDefaultAsync(m => m.AssetId == metric.AssetId && m.MetricId == metric.MetricId && m.DimensionHash == metric.DimensionHash, cancellationToken);

            if (existing == null)
            {
                await _context.AssetMetricCurrents.AddAsync(metric, cancellationToken);
            }
            else
            {
                _context.Entry(existing).CurrentValues.SetValues(metric);
            }
        }
        await _context.SaveChangesAsync(cancellationToken);
    }
}
