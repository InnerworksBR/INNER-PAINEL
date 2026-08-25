using System.Collections.Immutable;
using System.Runtime.InteropServices;
using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Coleta informações do sistema (hostname, OS, arch).
/// </summary>
public sealed class SystemInfoCollector : IObservationCollector
{
    public string Name => "system_info";
    public int Priority => 1;

    public Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            var hostname = context.Hostname;
            var osVersion = GetOsVersion();
            var osName = GetOsName();
            var arch = GetArchitecture();
            var processorCount = Environment.ProcessorCount;
            var machineDomain = GetMachineDomain();

            // Hostname metric
            records.Add(new BatchRecord(
                RecordType: "inventory",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "host",
                DisplayName: hostname,
                Identifiers: new[]
                {
                    new Contracts.Records.AssetIdentifier("hostname", hostname, "high"),
                    new Contracts.Records.AssetIdentifier("machine_id", context.MachineFingerprint, "high")
                }.ToImmutableArray(),
                Properties: new Dictionary<string, string>
                {
                    ["os_name"] = osName,
                    ["os_version"] = osVersion,
                    ["architecture"] = arch,
                    ["processor_count"] = processorCount.ToString(),
                    ["domain"] = machineDomain ?? "",
                    ["platform"] = "windows"
                }.ToImmutableDictionary(),
                Capabilities: null,
                MetricKey: null,
                ValueType: null,
                ValueDouble: null,
                ValueLong: null,
                ValueBoolean: null,
                ValueString: null,
                Unit: null,
                Quality: null,
                Dimensions: null,
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

            // Processor count metric
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: context.CollectedAt,
                LocalAssetId: context.LocalAssetId,
                AssetType: "processor",
                DisplayName: "Processor Count",
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "host.processor.count",
                ValueType: "long",
                ValueDouble: null,
                ValueLong: processorCount,
                ValueBoolean: null,
                ValueString: null,
                Unit: "count",
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
                ErrorCode = "SYSTEM_INFO_COLLECT_EXCEPTION",
                ErrorMessage = ex.Message
            });
        }
    }

    private static string GetOsName()
    {
        try
        {
            return OperatingSystem.IsWindowsVersionAtLeast(10, 0, 26100)
                ? "Windows 11"
                : OperatingSystem.IsWindowsVersionAtLeast(10, 0, 19041)
                    ? "Windows 10"
                    : OperatingSystem.IsWindowsVersionAtLeast(6, 3)
                        ? "Windows 8.1"
                        : OperatingSystem.IsWindowsVersionAtLeast(6, 2)
                            ? "Windows 8"
                            : OperatingSystem.IsWindowsVersionAtLeast(6, 1)
                                ? "Windows 7"
                                : "Windows";
        }
        catch
        {
            return "Windows";
        }
    }

    private static string GetOsVersion()
    {
        try
        {
            return Environment.OSVersion.Version.ToString();
        }
        catch
        {
            return "Unknown";
        }
    }

    private static string GetArchitecture()
    {
        var arch = RuntimeInformation.OSArchitecture.ToString().ToLowerInvariant();
        return arch switch
        {
            "x64" or "amd64" => "x64",
            "arm64" or "aarch64" => "arm64",
            "x86" => "x86",
            _ => arch
        };
    }

    private static string? GetMachineDomain()
    {
        try
        {
            return Environment.GetEnvironmentVariable("USERDOMAIN");
        }
        catch
        {
            return null;
        }
    }
}
