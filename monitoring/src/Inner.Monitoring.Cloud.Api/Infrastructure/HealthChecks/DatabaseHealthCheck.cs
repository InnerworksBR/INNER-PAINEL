using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Inner.Monitoring.Cloud.Api.Infrastructure.HealthChecks;

/// <summary>
///     Health check para conexao com banco de dados.
/// </summary>
public sealed class DatabaseHealthCheck : IHealthCheck
{
    private readonly MonitoringDbContext _context;

    public DatabaseHealthCheck(MonitoringDbContext context)
    {
        _context = context;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // Verificar conexao basica
            var canConnect = await _context.Database.CanConnectAsync(cancellationToken);
            if (!canConnect)
            {
                return HealthCheckResult.Unhealthy("Cannot connect to database");
            }

            // Verificar migrations
            var pendingMigrations = await _context.Database.GetPendingMigrationsAsync(cancellationToken);
            if (pendingMigrations.Any())
            {
                return HealthCheckResult.Degraded(
                    $"Database has {pendingMigrations.Count()} pending migrations",
                    data: new Dictionary<string, object>
                    {
                        ["pending_migrations"] = pendingMigrations.ToList()
                    }
                );
            }

            // Verificar se schema existe
            var schemaExists = await CheckSchemaExistsAsync(cancellationToken);
            if (!schemaExists)
            {
                return HealthCheckResult.Unhealthy("Schema 'monitoring' does not exist");
            }

            return HealthCheckResult.Healthy("Database is healthy");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database health check failed", ex);
        }
    }

    private async Task<bool> CheckSchemaExistsAsync(CancellationToken cancellationToken)
    {
        try
        {
            await _context.Database.ExecuteSqlRawAsync(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = 'monitoring'",
                cancellationToken);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
