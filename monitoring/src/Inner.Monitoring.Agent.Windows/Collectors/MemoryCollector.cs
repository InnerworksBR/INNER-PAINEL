using System.Collections.Immutable;
using Inner.Monitoring.Contracts.Records;
using System.Runtime.InteropServices;

namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Coleta métricas de memória usando GlobalMemoryStatusEx P/Invoke.
/// </summary>
public sealed class MemoryCollector : IObservationCollector
{
    [StructLayout(LayoutKind.Sequential)]
    private struct MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MEMORYSTATUSEX lpBuffer);

    public string Name => "memory";
    public int Priority => 20;

    public Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            var memStatus = new MEMORYSTATUSEX { dwLength = (uint)Marshal.SizeOf<MEMORYSTATUSEX>() };

            if (!GlobalMemoryStatusEx(ref memStatus))
            {
                return Task.FromResult(new CollectionResult
                {
                    Records = records,
                    Success = false,
                    ErrorCode = "MEMORY_COLLECT_ERROR",
                    ErrorMessage = "Failed to call GlobalMemoryStatusEx"
                });
            }

            var totalBytes = (long)memStatus.ullTotalPhys;
            var availableBytes = (long)memStatus.ullAvailPhys;
            var usedBytes = totalBytes - availableBytes;
            var usagePercent = totalBytes > 0 ? (usedBytes / (double)totalBytes) * 100.0 : 0.0;

            // Memory usage percentage
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "memory",
                DisplayName: "Memory Usage",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.memory.usage_percent",
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

            // Total physical memory
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "memory",
                DisplayName: "Total Memory",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.memory.total_bytes",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: totalBytes,
                ValueBoolean: null,
                ValueString: null,
                Unit: "bytes",
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

            // Available memory
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "memory",
                DisplayName: "Available Memory",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.memory.available_bytes",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: availableBytes,
                ValueBoolean: null,
                ValueString: null,
                Unit: "bytes",
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

            // Used memory
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "memory",
                DisplayName: "Used Memory",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.memory.used_bytes",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: usedBytes,
                ValueBoolean: null,
                ValueString: null,
                Unit: "bytes",
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

            // Virtual memory info
            var totalVirtual = (long)memStatus.ullTotalVirtual;
            var availVirtual = (long)memStatus.ullAvailVirtual;
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "memory",
                DisplayName: "Virtual Total",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.memory.virtual_total_bytes",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: totalVirtual,
                ValueBoolean: null,
                ValueString: null,
                Unit: "bytes",
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
                ErrorCode = "MEMORY_COLLECT_EXCEPTION",
                ErrorMessage = ex.Message
            });
        }
    }
}
