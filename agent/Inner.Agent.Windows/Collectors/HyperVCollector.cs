using System.Globalization;
using System.Management;
using Inner.Agent.Windows.Contracts;
using Microsoft.Extensions.Logging;

namespace Inner.Agent.Windows.Collectors;

[System.Runtime.Versioning.SupportedOSPlatform("windows")]
public sealed class HyperVCollector(ILogger<HyperVCollector> logger)
{
    private const string HyperVNamespace = @"root\virtualization\v2";
    private const string VirtualMachineQuery =
        "SELECT Name, ElementName, EnabledState, OnTimeInMilliseconds, Description " +
        "FROM Msvm_ComputerSystem WHERE Description = 'Microsoft Virtual Computer System'";

    public Task<IReadOnlyList<VirtualMachineMetrics>> CollectAsync(CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        return Task.Run(() => Collect(cancellationToken), cancellationToken);
    }

    private IReadOnlyList<VirtualMachineMetrics> Collect(CancellationToken cancellationToken)
    {
        var result = new List<VirtualMachineMetrics>();
        try
        {
            var summaries = ReadVirtualMachineSummaries(cancellationToken);
            var diskSizes = ReadVirtualDiskSizes(cancellationToken);

            using var searcher = new ManagementObjectSearcher(HyperVNamespace, VirtualMachineQuery);
            using var objects = searcher.Get();

            foreach (ManagementObject vm in objects)
            {
                cancellationToken.ThrowIfCancellationRequested();
                using (vm)
                {
                    var hyperVId = vm["Name"]?.ToString()?.Trim();
                    var name = vm["ElementName"]?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(hyperVId) || string.IsNullOrWhiteSpace(name)) continue;

                    summaries.TryGetValue(hyperVId, out var summary);
                    var state = summary?.EnabledState ?? vm["EnabledState"];
                    var uptime = summary?.UptimeSeconds ?? ReadMillisecondsAsSeconds(vm["OnTimeInMilliseconds"]);

                    result.Add(new VirtualMachineMetrics(
                        hyperVId,
                        name,
                        HyperVStateParser.Parse(state),
                        summary?.ProcessorLoad,
                        ReadAssignedMemoryMb(vm, cancellationToken),
                        summary?.MemoryUsageMb,
                        uptime,
                        diskSizes.GetValueOrDefault(hyperVId)));
                }
            }
        }
        catch (ManagementException error)
        {
            logger.LogWarning(error, "Hyper-V WMI is unavailable or access was denied");
            throw;
        }
        catch (Exception error)
        {
            logger.LogError(error, "Hyper-V metric collection failed");
            throw;
        }

        return result;
    }

    private Dictionary<string, VirtualMachineSummary> ReadVirtualMachineSummaries(CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, VirtualMachineSummary>(StringComparer.OrdinalIgnoreCase);
        try
        {
            using var serviceClass = new ManagementClass(HyperVNamespace, "Msvm_VirtualSystemManagementService", null);
            using var services = serviceClass.GetInstances();
            using var service = services.Cast<ManagementObject>().FirstOrDefault();
            if (service is null) return result;

            using var input = service.GetMethodParameters("GetSummaryInformation");
            input["SettingData"] = null;
            input["RequestedInformation"] = new uint[] { 0, 1, 100, 101, 103, 105 };

            using var output = service.InvokeMethod("GetSummaryInformation", input, null);
            var returnValue = Convert.ToUInt32(output?["ReturnValue"] ?? 32768, CultureInfo.InvariantCulture);
            if (returnValue != 0)
            {
                logger.LogWarning("Hyper-V GetSummaryInformation returned {ReturnValue}", returnValue);
                return result;
            }

            if (output?["SummaryInformation"] is not ManagementBaseObject[] summaries) return result;
            foreach (var summary in summaries)
            {
                cancellationToken.ThrowIfCancellationRequested();
                using (summary)
                {
                    var hyperVId = summary["Name"]?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(hyperVId)) continue;

                    result[hyperVId] = new VirtualMachineSummary(
                        summary["ElementName"]?.ToString()?.Trim(),
                        summary["EnabledState"],
                        HyperVValueMapper.PercentOrNull(ReadNullableDouble(summary["ProcessorLoad"])),
                        ReadNullableDouble(summary["MemoryUsage"]),
                        ReadNullableLong(summary["UpTime"]));
                }
            }
        }
        catch (ManagementException error)
        {
            logger.LogWarning(error, "Hyper-V summary information is unavailable; VM usage metrics will be partial");
        }

        return result;
    }

    private static double? ReadAssignedMemoryMb(ManagementObject vm, CancellationToken cancellationToken)
    {
        try
        {
            using var settings = vm.GetRelated(
                "Msvm_VirtualSystemSettingData",
                "Msvm_SettingsDefineState",
                null,
                null,
                "SettingData",
                "ManagedElement",
                false,
                null);

            foreach (ManagementObject setting in settings)
            {
                using (setting)
                {
                    if (!string.Equals(
                            setting["VirtualSystemType"]?.ToString(),
                            "Microsoft:Hyper-V:System:Realized",
                            StringComparison.OrdinalIgnoreCase))
                        continue;

                    using var memorySettings = setting.GetRelated("Msvm_MemorySettingData");
                    foreach (ManagementObject memorySetting in memorySettings)
                    {
                        cancellationToken.ThrowIfCancellationRequested();
                        using (memorySetting)
                        {
                            if (Convert.ToUInt32(memorySetting["ResourceType"] ?? 0, CultureInfo.InvariantCulture) != 4)
                                continue;

                            return ReadNullableDouble(memorySetting["VirtualQuantity"]);
                        }
                    }
                }
            }
        }
        catch (ManagementException)
        {
            // Memory assignment is optional. Summary metrics can still be sent.
        }

        return null;
    }

    private static Dictionary<string, double?> ReadVirtualDiskSizes(CancellationToken cancellationToken)
    {
        var result = new Dictionary<string, double?>(StringComparer.OrdinalIgnoreCase);
        using var searcher = new ManagementObjectSearcher(
            HyperVNamespace,
            "SELECT InstanceID, HostResource FROM Msvm_StorageAllocationSettingData WHERE ResourceType = 31");
        using var objects = searcher.Get();

        foreach (ManagementObject disk in objects)
        {
            cancellationToken.ThrowIfCancellationRequested();
            using (disk)
            {
                var instanceId = disk["InstanceID"]?.ToString();
                var hostResource = disk["HostResource"] as string[];
                var path = hostResource?.FirstOrDefault();
                if (string.IsNullOrWhiteSpace(instanceId) || string.IsNullOrWhiteSpace(path) || !File.Exists(path)) continue;

                var vmId = ExtractVmId(instanceId);
                if (string.IsNullOrWhiteSpace(vmId)) continue;
                var sizeGb = new FileInfo(path).Length / 1024d / 1024d / 1024d;
                result[vmId] = result.GetValueOrDefault(vmId, 0) + sizeGb;
            }
        }

        return result;
    }

    private static string? ExtractVmId(string instanceId)
    {
        var marker = "Microsoft:{";
        var markerIndex = instanceId.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (markerIndex < 0) return null;
        var start = markerIndex + "Microsoft:".Length;
        var end = instanceId.IndexOf('}', start);
        return end > start ? instanceId[start..(end + 1)] : null;
    }

    private static double? ReadNullableDouble(object? value)
    {
        if (value is null) return null;
        try
        {
            var converted = Convert.ToDouble(value, CultureInfo.InvariantCulture);
            return double.IsFinite(converted) ? converted : null;
        }
        catch
        {
            return null;
        }
    }

    private static long? ReadNullableLong(object? value)
    {
        if (value is null) return null;
        try
        {
            var converted = Convert.ToInt64(value, CultureInfo.InvariantCulture);
            return converted >= 0 ? converted : null;
        }
        catch
        {
            return null;
        }
    }

    private static long? ReadMillisecondsAsSeconds(object? value)
    {
        var milliseconds = ReadNullableDouble(value);
        return milliseconds is >= 0 ? (long)(milliseconds.Value / 1000) : null;
    }

    private sealed record VirtualMachineSummary(
        string? ElementName,
        object? EnabledState,
        double? ProcessorLoad,
        double? MemoryUsageMb,
        long? UptimeSeconds);
}

public static class HyperVStateParser
{
    public static HyperVState Parse(object? rawState)
    {
        var state = rawState?.ToString()?.Trim();
        return state switch
        {
            "2" or "Running" => HyperVState.Running,
            "32768" or "Paused" => HyperVState.Paused,
            _ => HyperVState.Off
        };
    }
}

public static class HyperVValueMapper
{
    public static double? BytesToMegabytes(double? bytes) =>
        bytes is >= 0 ? bytes.Value / 1024d / 1024d : null;

    public static double? PercentOrNull(double? value) =>
        value is >= 0 and <= 100 ? value : null;
}
