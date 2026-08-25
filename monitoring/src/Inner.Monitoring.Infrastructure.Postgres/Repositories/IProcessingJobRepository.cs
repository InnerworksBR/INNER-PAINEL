using Inner.Monitoring.Domain.Entities;

namespace Inner.Monitoring.Infrastructure.Postgres.Repositories;

/// <summary>
///     Interface para repositório de Processing Jobs.
/// </summary>
public interface IProcessingJobRepository
{
    Task<ProcessingJob?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<ProcessingJob?> GetNextAvailableAsync(CancellationToken cancellationToken = default);
    Task<ProcessingJob?> GetNextAvailableForCompanyAsync(Guid companyId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProcessingJob>> GetByBatchIdAsync(Guid batchRowId, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProcessingJob>> GetStaleJobsAsync(TimeSpan staleDuration, int limit = 100, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<ProcessingJob>> GetDeadLetterJobsAsync(Guid companyId, int limit = 100, CancellationToken cancellationToken = default);
    Task AddAsync(ProcessingJob job, CancellationToken cancellationToken = default);
    Task UpdateAsync(ProcessingJob job, CancellationToken cancellationToken = default);
    Task AddRangeAsync(IEnumerable<ProcessingJob> jobs, CancellationToken cancellationToken = default);

    // Metric Definitions
    Task<MetricDefinition?> GetMetricDefinitionByKeyAsync(string metricKey, CancellationToken cancellationToken = default);
    Task<MetricDefinition?> GetMetricDefinitionByIdAsync(int id, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<MetricDefinition>> GetAllActiveMetricDefinitionsAsync(CancellationToken cancellationToken = default);
    Task AddMetricDefinitionAsync(MetricDefinition definition, CancellationToken cancellationToken = default);
    Task UpdateMetricDefinitionAsync(MetricDefinition definition, CancellationToken cancellationToken = default);

    // Metric Samples (write operations)
    Task AddMetricSampleAsync(MetricSample sample, CancellationToken cancellationToken = default);
    Task AddMetricSamplesAsync(IEnumerable<MetricSample> samples, CancellationToken cancellationToken = default);

    // Metric Rollups
    Task AddMetricRollup5mAsync(MetricRollup5m rollup, CancellationToken cancellationToken = default);
    Task AddMetricRollup1hAsync(MetricRollup1h rollup, CancellationToken cancellationToken = default);

    // Asset Metric Current (batch upsert support)
    Task UpsertAssetMetricCurrentsAsync(IEnumerable<AssetMetricCurrent> metrics, CancellationToken cancellationToken = default);
}
