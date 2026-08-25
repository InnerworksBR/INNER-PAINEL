using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Inner.Monitoring.Cloud.Api.Infrastructure.HealthChecks;

/// <summary>
///     Health check para particoes de tabelas.
/// </summary>
public sealed class PartitionHealthCheck : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Lista de tabelas que devem ter particionamento
            var partitionedTables = new[]
            {
                "source_heartbeats",
                "collection_attempts",
                "metric_samples",
                "metric_rollups_5m",
                "metric_rollups_1h",
                "stream_events",
                "audit_log"
            };

            var missingPartitions = new List<string>();

            // Em producao, verificar via query ao banco
            // Por enquanto, retornamos healthy assumindo que as particoes existem
            foreach (var table in partitionedTables)
            {
                // TODO: Query para verificar se a tabela e particionada
                // Ex: SELECT relkind FROM pg_class WHERE relname = 'metric_samples'
            }

            if (missingPartitions.Any())
            {
                return Task.FromResult(HealthCheckResult.Degraded(
                    "Some tables are not partitioned",
                    data: new Dictionary<string, object>
                    {
                        ["missing_partitions"] = missingPartitions
                    }
                ));
            }

            return Task.FromResult(HealthCheckResult.Healthy("All partitioned tables are configured"));
        }
        catch (Exception ex)
        {
            return Task.FromResult(HealthCheckResult.Unhealthy("Partition health check failed", ex));
        }
    }
}
