using System.Globalization;
using System.Management;
using Inner.Agent.Windows.Contracts;
using Microsoft.Extensions.Logging;

namespace Inner.Agent.Windows.Collectors;

[System.Runtime.Versioning.SupportedOSPlatform("windows")]
public sealed class HyperVCollector(ILogger<HyperVCollector> logger)
{
    private const string HyperVNamespace = @"root\virtualization\v2";

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
            var diskSizes = ReadVirtualDiskSizes(cancellationToken);
            using var searcher = new ManagementObjectSearcher(
                HyperVNamespace,
                "SELECT Name, ElementName, EnabledState, OnTimeInMilliseconds, MemoryAssigned, MemoryDemand, ProcessorLoad " +
                "FROM Msvm_ComputerSystem WHERE VirtualSystemType = 'Microsoft:Hyper-V:System:vm'");
            using var objects = searcher.Get();

            foreach (ManagementObject vm in objects)
            {
                cancellationToken.ThrowIfCancellationRequested();
                using (vm)
                {
                    var hyperVId = vm["Name"]?.ToString()?.Trim();
                    var name = vm["ElementName"]?.ToString()?.Trim();
                    if (string.IsNullOrWhiteSpace(hyperVId) || string.IsNullOrWhiteSpace(name)) continue;

                    var assignedBytes = ReadNullableDouble(vm["MemoryAssigned"]);
                    var demandBytes = ReadNullableDouble(vm["MemoryDemand"]);
                    result.Add(new VirtualMachineMetrics(
                        hyperVId,
                        name,
                        HyperVStateParser.Parse(vm["EnabledState"]),
                        HyperVValueMapper.PercentOrNull(ReadNullableDouble(vm["ProcessorLoad"])),
                        HyperVValueMapper.BytesToMegabytes(assignedBytes),
                        HyperVValueMapper.BytesToMegabytes(demandBytes),
                        ReadUptimeSeconds(vm["OnTimeInMilliseconds"]),
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

    private static long? ReadUptimeSeconds(object? value)
    {
        var milliseconds = ReadNullableDouble(value);
        return milliseconds is >= 0 ? (long)(milliseconds.Value / 1000) : null;
    }
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
