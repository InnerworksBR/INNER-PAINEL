using System.Text.Json;
using Inner.Monitoring.Cloud.Api.Authorization;
using Inner.Monitoring.Contracts.Records;
using Inner.Monitoring.Infrastructure.Postgres;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Inner.Monitoring.Cloud.Api.Controllers;

/// <summary>
/// Controller SSE para stream em tempo real.
/// </summary>
[ApiController]
[Route("api/monitoring/v1/companies/{companyId:guid}/stream")]
[Produces("text/event-stream")]
[RequirePortalAuth]
public class StreamController : PortalControllerBase
{
    private readonly MonitoringDbContext _db;
    private readonly ILogger<StreamController> _logger;

    public StreamController(
        MonitoringDbContext db,
        ILogger<StreamController> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Stream SSE de eventos em tempo real.
    /// Cursor durável em monitoring.stream_events.
    /// </summary>
    [HttpGet]
    [ResponseCache(Duration = 0, NoStore = true)]
    public async Task GetStream(
        [FromRoute] Guid companyId,
        [FromQuery] long? cursor,
        CancellationToken cancellationToken)
    {
        var tokenCompanyId = GetCompanyId();
        if (tokenCompanyId != companyId && !GetUserContext().IsPlatformAdmin)
        {
            Response.StatusCode = 403;
            await Response.WriteAsync("Forbidden\n");
            return;
        }

        _logger.LogInformation("SSE stream started for company {CompanyId}", companyId);

        Response.ContentType = "text/event-stream";
        Response.Headers.CacheControl = "no-cache";
        Response.Headers.Connection = "keep-alive";

        var lastSequence = cursor ?? 0;
        var keepAlive = 0;

        try
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                // Buscar novos eventos
                var events = await _db.StreamEvents
                    .Where(e => e.CompanyId == companyId && EF.Property<long>(e, "Id") > lastSequence)
                    .OrderBy(e => EF.Property<long>(e, "Id"))
                    .Take(100)
                    .ToListAsync(cancellationToken);

                if (events.Count > 0)
                {
                    foreach (var evt in events)
                    {
                        var streamEvent = MapToStreamEvent(evt);
                        var json = JsonSerializer.Serialize(streamEvent, new JsonSerializerOptions
                        {
                            PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
                        });

                        await Response.WriteAsync($"event: {streamEvent.EventType}\n", cancellationToken);
                        await Response.WriteAsync($"data: {json}\n\n", cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);

                        lastSequence = evt.Id.GetHashCode();
                    }
                }
                else
                {
                    // Keep-alive a cada 30 segundos
                    keepAlive++;
                    if (keepAlive >= 30)
                    {
                        await Response.WriteAsync(": keepalive\n\n", cancellationToken);
                        await Response.Body.FlushAsync(cancellationToken);
                        keepAlive = 0;
                    }
                }

                // Pequeno delay para não sobrecarregar
                await Task.Delay(1000, cancellationToken);
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogInformation("SSE stream closed for company {CompanyId}", companyId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSE stream error for company {CompanyId}", companyId);
        }
        finally
        {
            await Response.WriteAsync("event: stream_closed\ndata: {}\n\n", cancellationToken);
        }
    }

    private static StreamEvent MapToStreamEvent(Domain.Entities.StreamEvent evt)
    {
        var payload = ParsePayload(evt);

        return new StreamEvent(
            EventType: evt.EventKind,
            EventId: evt.Id,
            CompanyId: evt.CompanyId,
            SiteId: evt.SiteId,
            AssetId: evt.AssetId,
            SourceId: evt.SourceId,
            Timestamp: evt.Timestamp,
            Payload: payload);
    }

    private static StreamEventPayload ParsePayload(Domain.Entities.StreamEvent evt)
    {
        try
        {
            using var doc = JsonDocument.Parse(evt.Payload);
            var root = doc.RootElement;

            MetricUpdate? metrics = null;
            EventResponse? eventResp = null;
            string? assetState = null;
            string? prevAssetState = null;
            string? sourceStatus = null;
            string? prevSourceStatus = null;

            if (root.TryGetProperty("asset_state", out var asEl))
                assetState = asEl.GetString();
            if (root.TryGetProperty("previous_asset_state", out var pasEl))
                prevAssetState = pasEl.GetString();
            if (root.TryGetProperty("source_status", out var ssEl))
                sourceStatus = ssEl.GetString();
            if (root.TryGetProperty("previous_source_status", out var pssEl))
                prevSourceStatus = pssEl.GetString();

            if (root.TryGetProperty("metrics", out var mEl))
            {
                var metricList = new List<MetricSnapshot>();
                foreach (var m in mEl.EnumerateArray())
                {
                    metricList.Add(new MetricSnapshot(
                        MetricKey: m.GetProperty("metric_key").GetString() ?? "",
                        DisplayName: m.GetProperty("display_name").GetString() ?? "",
                        Unit: m.TryGetProperty("unit", out var u) ? u.GetString() : null,
                        Value: m.TryGetProperty("value", out var v) ? v.GetDouble() : null,
                        Quality: m.TryGetProperty("quality", out var q) ? q.GetString() : null,
                        CollectedAt: m.GetProperty("collected_at").GetDateTimeOffset()));
                }
                metrics = new MetricUpdate(evt.AssetId ?? Guid.Empty, metricList);
            }

            return new StreamEventPayload(
                AssetState: assetState,
                PreviousAssetState: prevAssetState,
                SourceStatus: sourceStatus,
                PreviousSourceStatus: prevSourceStatus,
                Metrics: metrics,
                Event: eventResp);
        }
        catch
        {
            return new StreamEventPayload(null, null, null, null, null, null);
        }
    }
}
