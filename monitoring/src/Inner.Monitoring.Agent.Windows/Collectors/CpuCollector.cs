using System.Collections.Immutable;
using Inner.Monitoring.Contracts.Records;
using System.Runtime.InteropServices;

namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Coleta métricas de CPU usando GetSystemTimes P/Invoke.
/// </summary>
public sealed class CpuCollector : IObservationCollector
{
    private const long TicksPerSecond = 10_000_000L;

    [StructLayout(LayoutKind.Sequential)]
    private struct FILETIME
    {
        public uint dwLowDateTime;
        public uint dwHighDateTime;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool GetSystemTimes(
        out FILETIME lpIdleTime,
        out FILETIME lpKernelTime,
        out FILETIME lpUserTime);

    public string Name => "cpu";
    public int Priority => 10;

    public Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            if (!GetSystemTimes(out var idle, out var kernel, out var user))
            {
                return Task.FromResult(new CollectionResult
                {
                    Records = records,
                    Success = false,
                    ErrorCode = "CPU_COLLECT_ERROR",
                    ErrorMessage = "Failed to call GetSystemTimes"
                });
            }

            var idleTime = ((ulong)idle.dwHighDateTime << 32) | idle.dwLowDateTime;
            var kernelTime = ((ulong)kernel.dwHighDateTime << 32) | kernel.dwLowDateTime;
            var userTime = ((ulong)user.dwHighDateTime << 32) | user.dwLowDateTime;

            // Kernel time includes idle time
            var busyTime = kernelTime + userTime - idleTime;
            var totalTime = kernelTime + userTime;

            var totalSeconds = totalTime / (double)TicksPerSecond;
            var idleSeconds = idleTime / (double)TicksPerSecond;
            var busySeconds = busyTime / (double)TicksPerSecond;

            var usagePercent = totalSeconds > 0 ? (busySeconds / totalSeconds) * 100.0 : 0.0;

            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "processor",
                DisplayName: "CPU Usage",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.cpu.usage_percent",
                ValueType: "double",
                ValueDouble: Math.Round(usagePercent, 2),
                ValueLong: null,
                ValueBoolean: null,
                ValueString: null,
                Unit: "percent",
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

            // Add idle metric
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "processor",
                DisplayName: "CPU Idle",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.cpu.idle_percent",
                ValueType: "double",
                ValueDouble: Math.Round(100.0 - usagePercent, 2),
                ValueLong: null,
                ValueBoolean: null,
                ValueString: null,
                Unit: "percent",
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
                ErrorCode = "CPU_COLLECT_EXCEPTION",
                ErrorMessage = ex.Message
            });
        }
    }
}
