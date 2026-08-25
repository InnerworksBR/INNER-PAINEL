using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller para health check da plataforma.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/platform")]
[Produces("application/json")]
public class PlatformController : ControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly ILogger<PlatformController> _logger;

    public PlatformController(
        MonitoringDbContext db,
        ILogger<PlatformController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Health check da plataforma.
    /// </summary>
    [HttpGet("health")]
    [ProducesResponseType(typeof(PlatformHealthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetHealth(CancellationToken cancellationToken)
    {
        var timestamp = DateTimeOffset.UtcNow;
        var dbStatus = "healthy";
        var queryDuration = 0L;

        try
        {
            var sw = System.Diagnostics.Stopwatch.StartNew();
            var canConnect = await _db.Database.CanConnectAsync(cancellationToken);
            sw.Stop();
            queryDuration = sw.ElapsedMilliseconds;

            if (!canConnect)
            {
                dbStatus = "unhealthy";
            }
        }
        catch (Exception ex)
        {
            dbStatus = "unhealthy";
            _logger.LogWarning(ex, "Database health check failed");
        }

        var activeConnections = 0;
        try
        {
            var connCount = await _db.Database
                .SqlQuery<int>($"SELECT COUNT(*) FROM pg_stat_activity WHERE datname = current_database()")
                .FirstAsync(cancellationToken);
            activeConnections = connCount;
        }
        catch
        {
            // Ignorar erros de query
        }

        var overallStatus = dbStatus == "healthy" ? "healthy" : "degraded";

        return Ok(new PlatformHealthResponse(
            Status: overallStatus,
            Timestamp: timestamp,
            Database: new DatabaseHealth(
                Status: dbStatus,
                ConnectionPoolSize: 20,
                ActiveConnections: activeConnections,
                QueryDurationMs: queryDuration),
            Api: new ApiHealth(
                Status: "healthy",
                UptimeSeconds: GetUptimeSeconds(),
                ActiveSseConnections: GetActiveSseConnections(),
                RequestsPerMinute: GetRequestsPerMinute())));
    }

    private static double GetUptimeSeconds()
    {
        var startTimeStr = Environment.GetEnvironmentVariable("PROCESS_START_TIME");
        if (!string.IsNullOrEmpty(startTimeStr) && long.TryParse(startTimeStr, out var startTime))
        {
            return (DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(startTime)).TotalSeconds;
        }
        return 0;
    }

    private static int GetActiveSseConnections()
    {
        // Em produção, isso viria de um Counter ou cache compartilhado
        return 0;
    }

    private static int GetRequestsPerMinute()
    {
        // Em produção, isso viria de métricas
        return 0;
    }
}
