using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

namespace Inner.Monitoring.Cloud.Api.Infrastructure.HealthChecks;

/// <summary>
///     Health check para migrations pendentes.
/// </summary>
public sealed class MigrationsHealthCheck : IHealthCheck
{
    private readonly IServiceProvider _serviceProvider;

    public MigrationsHealthCheck(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider
                .GetRequiredService<Inner.Monitoring.Infrastructure.Postgres.MonitoringDbContext>();

            // Check if we can connect
            if (!await dbContext.Database.CanConnectAsync(cancellationToken))
            {
                return HealthCheckResult.Unhealthy("Cannot connect to database");
            }

            // Get pending migrations using reflection for compatibility
            var pendingMigrations = dbContext.Database
                .GetType()
                .GetMethod("GetPendingMigrations", BindingFlags.Public | BindingFlags.Instance);

            if (pendingMigrations != null)
            {
                var result = pendingMigrations.Invoke(dbContext.Database, null) as IEnumerable<object>;
                var pendingList = result?.Select(m => m.ToString()).Where(m => m != null).ToList() ?? new List<string?>();

                if (pendingList.Count == 0)
                {
                    return HealthCheckResult.Healthy("All migrations applied");
                }

                return HealthCheckResult.Unhealthy(
                    $"{pendingList.Count} migrations pending",
                    data: new Dictionary<string, object>
                    {
                        ["pending_migrations"] = pendingList
                    }
                );
            }

            return HealthCheckResult.Healthy("Migration check not available");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Could not check migrations", ex);
        }
    }
}
