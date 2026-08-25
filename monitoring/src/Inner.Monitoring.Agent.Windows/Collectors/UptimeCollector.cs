using System.Collections.Immutable;
using Inner.Monitoring.Contracts.Records;
using System.Runtime.InteropServices;

namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Coleta métrica de uptime usando GetTickCount64 P/Invoke.
/// </summary>
public sealed class UptimeCollector : IObservationCollector
{
    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern ulong GetTickCount64();

    public string Name => "uptime";
    public int Priority => 5;

    public Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            var uptimeMs = GetTickCount64();
            var uptimeSeconds = uptimeMs / 1000.0;

            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "system",
                DisplayName: "System Uptime",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.uptime.seconds",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: (long)uptimeSeconds,
                ValueBoolean: null,
                ValueString: null,
                Unit: "seconds",
                Quality: "good",
                Dimensions: ImmutableDictionary<string, string>.Empty,
                Protocol: null,
                Result: null,
                StartedAt: null,
                FinishedAt: null,
                DurationMs: null,
                RetryCount: null,
                ErrorCode: null,
                Details: null,
                EventType: null,
                Severity: null,
                Message: null,
                Data: null));

            return Task.FromResult(new CollectionResult { Records = records });
        }
        catch (Exception ex)
        {
            return Task.FromResult(new CollectionResult
            {
                Records = records,
                Success = false,
                ErrorCode = "UPTIME_COLLECT_EXCEPTION",
                ErrorMessage = ex.Message
            });
        }
    }
}
