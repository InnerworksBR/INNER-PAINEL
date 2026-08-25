using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Inner.Monitoring.Cloud.Api.Infrastructure.HealthChecks;

/// <summary>
///     Resultado formatado de health check.
/// </summary>
public sealed class HealthCheckResponse
{
    public string Status { get; set; } = "Healthy";
    public DateTimeOffset Timestamp { get; set; } = DateTimeOffset.UtcNow;
    public string Version { get; set; } = "1.0.0";
    public double TotalDurationMs { get; set; }
    public Dictionary<string, HealthCheckEntry> Checks { get; set; } = new();

    public void AddCheck(string name, string status, double durationMs, string? description = null, string? error = null)
    {
        Checks[name] = new HealthCheckEntry
        {
            Status = status,
            Duration = durationMs,
            Description = description,
            Error = error
        };
    }
}

/// <summary>
///     Entry individual de health check.
/// </summary>
public sealed class HealthCheckEntry
{
    public string Status { get; set; } = "Healthy";
    public double Duration { get; set; }
    public string? Description { get; set; }
    public string? Error { get; set; }
}

/// <summary>
///     Wrapper para dados de health check individual.
/// </summary>
public sealed class HealthCheckData
{
    public required string Status { get; init; }
    public string? Description { get; init; }
    public string? Exception { get; init; }
    public TimeSpan Duration { get; init; }
}

/// <summary>
///     Writer para output JSON dos health checks.
/// </summary>
public static class HealthCheckJsonWriter
{
    public static async Task WriteResponseAsync(
        Stream output,
        HealthCheckStatus status,
        double totalDurationMs,
        IReadOnlyDictionary<string, HealthCheckData> entries,
        CancellationToken cancellationToken)
    {
        var response = new HealthCheckResponse
        {
            Status = status.ToString(),
            Timestamp = DateTimeOffset.UtcNow,
            TotalDurationMs = totalDurationMs
        };

        foreach (var entry in entries)
        {
            response.AddCheck(
                entry.Key,
                entry.Value.Status,
                entry.Value.Duration.TotalMilliseconds,
                entry.Value.Description,
                entry.Value.Exception
            );
        }

        var options = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
            WriteIndented = true
        };

        await JsonSerializer.SerializeAsync(output, response, options, cancellationToken);
    }

    /// <summary>
    ///     Writer para ASP.NET Core Health Checks.
    /// </summary>
    public static async Task WriteAspNetResponseAsync(
        Stream output,
        Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report,
        CancellationToken cancellationToken)
    {
        var status = report.Status switch
        {
            Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Healthy => HealthCheckStatus.Healthy,
            Microsoft.Extensions.Diagnostics.HealthChecks.HealthStatus.Degraded => HealthCheckStatus.Degraded,
            _ => HealthCheckStatus.Unhealthy
        };

        var entries = new Dictionary<string, HealthCheckData>();
        foreach (var entry in report.Entries)
        {
            entries[entry.Key] = new HealthCheckData
            {
                Status = entry.Value.Status.ToString(),
                Description = entry.Value.Description,
                Exception = entry.Value.Exception?.Message,
                Duration = entry.Value.Duration
            };
        }

        await WriteResponseAsync(output, status, report.TotalDuration.TotalMilliseconds, entries, cancellationToken);
    }

    /// <summary>
    ///     Writer wrapper para MapHealthChecks delegate (sem CancellationToken).
    /// </summary>
    public static Task WriteAspNetResponseAsync(
        Microsoft.AspNetCore.Http.HttpContext context,
        Microsoft.Extensions.Diagnostics.HealthChecks.HealthReport report)
    {
        return WriteAspNetResponseAsync(context.Response.Body, report, CancellationToken.None);
    }
}

/// <summary>
///     Status de health check.
/// </summary>
public enum HealthCheckStatus
{
    Healthy,
    Degraded,
    Unhealthy
}
