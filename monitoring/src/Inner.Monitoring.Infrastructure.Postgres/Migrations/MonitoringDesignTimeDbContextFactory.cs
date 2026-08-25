using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Inner.Monitoring.Infrastructure.Migrations;

/// <summary>
///     Factory para criar migrations.
/// </summary>
public class MonitoringDesignTimeDbContextFactory : IDesignTimeDbContextFactory<MonitoringDbContext>
{
    public MonitoringDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable("DATABASE_URL")
            ?? "Host=localhost;Database=inner_monitoring;Username=postgres;Password=postgres";

        var optionsBuilder = new DbContextOptionsBuilder<MonitoringDbContext>();
        optionsBuilder.UseNpgsql(connectionString);

        return new MonitoringDbContext(optionsBuilder.Options);
    }
}
