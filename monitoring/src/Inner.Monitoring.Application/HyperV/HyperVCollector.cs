using System.Management;
using Inner.Monitoring.Contracts.Collectors;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Records;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.HyperV;

/// <summary>
///     Implementação do coletor Hyper-V usando WMI/CIM.
/// </summary>
[System.Runtime.Versioning.SupportedOSPlatform("windows")]
public sealed class HyperVCollector : IHyperVCollector
{
    private const string VirtualizationNamespace = @"root\virtualization\v2";
    private const string ComputerSystemClass = "Msvm_ComputerSystem";
    private const string VirtualSystemSettingDataClass = "Msvm_VirtualSystemSettingData";
    private const string ProcessorClass = "Msvm_Processor";
    private const string MemoryClass = "Msvm_Memory";
    private const string EthernetSwitchClass = "Msvm_EthernetSwitch";
    private const string EthernetPortClass = "Msvm_EthernetPortAllocationSettingData";
    private const string VirtualDiskClass = "Msvm_StorageAllocationSettingData";

    private readonly ILogger<HyperVCollector> _logger;
    private readonly string? _smbiosUuid;
    private readonly string _hostName;

    public string Name => "hyperv";
    public int Priority => 50;

    public HyperVCollector(ILogger<HyperVCollector> logger)
    {
        _logger = logger;
        _smbiosUuid = GetSmbiosUuid();
        _hostName = Environment.MachineName;
    }

    /// <inheritdoc />
    public async Task<HyperVInventory> GetInventoryAsync(CancellationToken ct)
    {
        return await Task.Run(() => CollectInventory(ct), ct);
    }

    /// <inheritdoc />
    public async Task<IEnumerable<VmMetrics>> GetVmMetricsAsync(CancellationToken ct)
    {
        return await Task.Run(() => CollectVmMetrics(ct), ct);
    }

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync(CancellationToken ct)
    {
        return await Task.Run(() => CheckAvailability(ct), ct);
    }

    /// <inheritdoc />
    public async Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct)
    {
        var records = new List<BatchRecord>();

        try
        {
            if (!await IsAvailableAsync(ct))
            {
                return new CollectionResult
                {
                    Success = false,
                    ErrorCode = "HYPERV_UNAVAILABLE",
                    ErrorMessage = "Hyper-V is not available on this host.",
                    Records = records
                };
            }

            var inventory = await GetInventoryAsync(ct);

            // Host inventory records
            records.AddRange(CreateHostRecords(inventory, context));

            // VM inventory records
            foreach (var vm in inventory.VirtualMachines)
            {
                records.AddRange(CreateVmRecords(vm, inventory.HostId, context));
            }

            // VM metrics records
            var metrics = await GetVmMetricsAsync(ct);
            foreach (var vmMetric in metrics)
            {
                records.AddRange(CreateVmMetricRecords(vmMetric, context));
            }

            return new CollectionResult
            {
                Success = true,
                Records = records
            };
        }
        catch (ManagementException ex) when (ex.ErrorCode == ManagementStatus.AccessDenied)
        {
            _logger.LogWarning(ex, "Access denied to Hyper-V WMI namespace");
            return new CollectionResult
            {
                Success = false,
                ErrorCode = "HYPERV_ACCESS_DENIED",
                ErrorMessage = "Access denied. Run as Administrator.",
                Records = records
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting Hyper-V data");
            return new CollectionResult
            {
                Success = false,
                ErrorCode = "HYPERV_COLLECTION_ERROR",
                ErrorMessage = ex.Message,
                Records = records
            };
        }
    }

    private bool CheckAvailability(CancellationToken ct)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {ComputerSystemClass} WHERE Description LIKE '%Microsoft Virtual%'");

            using var collection = searcher.Get();
            return collection.Count > 0 || IsVirtualizationEnabled();
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Hyper-V not available");
            return false;
        }
    }

    private bool IsVirtualizationEnabled()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT VirtualizationFirmwareEnabled FROM Win32_ComputerSystem");
            using var collection = searcher.Get();
            foreach (ManagementObject obj in collection)
            {
                if (obj["VirtualizationFirmwareEnabled"] is bool enabled && enabled)
                {
                    return true;
                }
            }
        }
        catch
        {
            // Ignore
        }
        return false;
    }

    private HyperVInventory CollectInventory(CancellationToken ct)
    {
        var vms = new List<VirtualMachine>();
        var switches = new List<VirtualSwitch>();
        var disks = new List<VirtualDisk>();

        try
        {
            // Get all VMs
            using var vmSearcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {ComputerSystemClass} WHERE VirtualSystemType = 'Microsoft:Hyper-V:System:vm'");

            foreach (ManagementObject vm in vmSearcher.Get())
            {
                var vmId = vm["Name"]?.ToString();
                var vmName = vm["ElementName"]?.ToString();

                if (string.IsNullOrEmpty(vmId) || string.IsNullOrEmpty(vmName))
                    continue;

                var state = ParseVmState(vm["EnabledState"]?.ToString());
                var creationTime = ParseDateTime(vm["CreationTime"]?.ToString());

                // Get VM settings
                var vmSettings = GetVmSettings(vmId);
                var diskPaths = GetVmDiskPaths(vmId);
                var switchNames = GetVmSwitchNames(vmId);

                vms.Add(new VirtualMachine
                {
                    VmId = vmId,
                    VmName = vmName,
                    State = state,
                    ProcessorCount = vm["NumberOfProcessors"] is int procs ? procs : 0,
                    AssignedMemoryBytes = vm["MemoryAssigned"] is ulong mem ? (long)mem : 0,
                    CreationTime = creationTime,
                    Generation = vmSettings?.GetPropertyValue("Generation")?.ToString(),
                    DiskPaths = diskPaths,
                    VirtualSwitchNames = switchNames
                });

                // Collect disks for this VM
                foreach (var diskPath in diskPaths)
                {
                    var diskSize = GetDiskSize(diskPath);
                    disks.Add(new VirtualDisk
                    {
                        DiskId = ComputeDiskId(vmId, diskPath),
                        VmId = vmId,
                        DiskPath = diskPath,
                        Type = DetermineDiskType(diskPath),
                        CapacityBytes = diskSize
                    });
                }
            }

            // Get virtual switches
            using var switchSearcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {EthernetSwitchClass}");

            foreach (ManagementObject sw in switchSearcher.Get())
            {
                var switchId = sw["Name"]?.ToString();
                var switchName = sw["ElementName"]?.ToString();
                var switchType = ParseSwitchType(sw["SwitchType"]?.ToString());

                if (string.IsNullOrEmpty(switchId) || string.IsNullOrEmpty(switchName))
                    continue;

                var ports = GetSwitchPorts(switchId);
                var connectedVmIds = ports.Select(p => p.ConnectedVmId).Distinct().ToList();

                switches.Add(new VirtualSwitch
                {
                    SwitchId = switchId,
                    SwitchName = switchName,
                    Type = switchType,
                    ConnectedVmIds = connectedVmIds,
                    Ports = ports
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting Hyper-V inventory");
        }

        var runningCount = vms.Count(vm => vm.State == VmState.Running);

        return new HyperVInventory
        {
            HostId = _smbiosUuid ?? _hostName,
            HostName = _hostName,
            SmbiosUuid = _smbiosUuid,
            TotalProcessorCount = Environment.ProcessorCount,
            TotalMemoryBytes = GetTotalMemory(),
            VmCount = vms.Count,
            RunningVmCount = runningCount,
            VirtualMachines = vms,
            VirtualSwitches = switches,
            VirtualDisks = disks,
            CollectedAt = DateTimeOffset.UtcNow,
            IsAvailable = true
        };
    }

    private List<VmMetrics> CollectVmMetrics(CancellationToken ct)
    {
        var metrics = new List<VmMetrics>();

        try
        {
            // Get VM runtime data for performance
            using var runtimeSearcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM Msvm_VirtualSystemRuntimeSettingData WHERE SettingType = 3");

            foreach (ManagementObject runtime in runtimeSearcher.Get())
            {
                var parent = runtime["Parent"]?.ToString();
                if (string.IsNullOrEmpty(parent))
                    continue;

                var vmId = ExtractVmIdFromPort(parent);
                if (string.IsNullOrEmpty(vmId))
                    continue;

                var uptime = runtime["GuestStartupDuration"] is ulong duration
                    ? (long)(duration / 10_000_000) // Convert 100-nanosecond intervals to seconds
                    : 0;

                // Get CPU and memory from computer system
                using var csSearcher = new ManagementObjectSearcher(
                    VirtualizationNamespace,
                    $"SELECT * FROM {ComputerSystemClass} WHERE Name = '{vmId}'");

                foreach (ManagementObject cs in csSearcher.Get())
                {
                    var cpuUsage = cs["ProcessorLoad"] is int load ? (double)load : (double?)null;
                    var memAssigned = cs["MemoryAssigned"] is ulong mem ? (long)mem : 0;
                    var memDemand = cs["MemoryDemand"] is ulong demand ? (long)demand : 0;
                    var state = ParseVmState(cs["EnabledState"]?.ToString());

                    metrics.Add(new VmMetrics
                    {
                        VmId = vmId,
                        VmName = cs["ElementName"]?.ToString() ?? vmId,
                        State = state,
                        CpuUsagePercent = cpuUsage ?? 0,
                        CpuQuality = cpuUsage.HasValue ? MetricQuality.Good : MetricQuality.Unsupported,
                        MemoryAssignedBytes = memAssigned,
                        MemoryObservedBytes = memDemand,
                        MemoryUsagePercent = memAssigned > 0 && memDemand > 0
                            ? (double)memDemand / memAssigned * 100
                            : 0,
                        MemoryQuality = MetricQuality.Good,
                        UptimeSeconds = uptime,
                        UptimeQuality = MetricQuality.Good,
                        NetworkBytesPerSecond = 0,
                        NetworkQuality = MetricQuality.Unsupported,
                        DiskBytesPerSecond = 0,
                        DiskQuality = MetricQuality.Unsupported,
                        CollectedAt = DateTimeOffset.UtcNow
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error collecting VM metrics");
        }

        return metrics;
    }

    private ManagementObject? GetVmSettings(string vmId)
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {VirtualSystemSettingDataClass} WHERE VMId = '{vmId}'");

            foreach (ManagementObject settings in searcher.Get())
            {
                return settings;
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error getting VM settings for {VmId}", vmId);
        }
        return null;
    }

    private List<string> GetVmDiskPaths(string vmId)
    {
        var paths = new List<string>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {VirtualDiskClass} WHERE InstanceID LIKE '%{vmId}%'");

            foreach (ManagementObject disk in searcher.Get())
            {
                var hostResource = disk["HostResource"] as string[];
                if (hostResource?.Length > 0)
                {
                    paths.Add(hostResource[0]);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error getting disk paths for {VmId}", vmId);
        }
        return paths;
    }

    private List<string> GetVmSwitchNames(string vmId)
    {
        var names = new List<string>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {EthernetPortClass} WHERE Parent = '{vmId}%'");

            foreach (ManagementObject port in searcher.Get())
            {
                var switchName = port["HostResource"] as string[];
                if (switchName?.Length > 0)
                {
                    names.Add(switchName[0]);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error getting switch names for {VmId}", vmId);
        }
        return names;
    }

    private List<SwitchPort> GetSwitchPorts(string switchId)
    {
        var ports = new List<SwitchPort>();
        try
        {
            using var searcher = new ManagementObjectSearcher(
                VirtualizationNamespace,
                $"SELECT * FROM {EthernetPortClass} WHERE SystemName = '{switchId}'");

            foreach (ManagementObject port in searcher.Get())
            {
                var portId = port["Name"]?.ToString() ?? Guid.NewGuid().ToString();
                var connectedVmId = ExtractVmIdFromPort(port["Parent"]?.ToString());

                ports.Add(new SwitchPort
                {
                    PortId = portId,
                    PortName = port["ElementName"]?.ToString() ?? portId,
                    ConnectedVmId = connectedVmId
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error getting switch ports for {SwitchId}", switchId);
        }
        return ports;
    }

    private string ExtractVmIdFromPort(string? parent)
    {
        if (string.IsNullOrEmpty(parent))
            return string.Empty;

        // Parent format: "Microsoft:Hyper-V:VM:VMId"
        var parts = parent.Split(':');
        return parts.Length >= 4 ? parts[3] : parent;
    }

    private long GetDiskSize(string diskPath)
    {
        try
        {
            if (File.Exists(diskPath))
            {
                return new FileInfo(diskPath).Length;
            }
        }
        catch
        {
            // Ignore
        }
        return 0;
    }

    private string? GetSmbiosUuid()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT UUID FROM Win32_ComputerSystemProduct");
            foreach (ManagementObject obj in searcher.Get())
            {
                return obj["UUID"]?.ToString();
            }
        }
        catch
        {
            // Ignore
        }
        return null;
    }

    private long GetTotalMemory()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("root\\CIMV2", "SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
            foreach (ManagementObject obj in searcher.Get())
            {
                if (obj["TotalPhysicalMemory"] is ulong mem)
                {
                    return (long)mem;
                }
            }
        }
        catch
        {
            // Ignore
        }
        return 0;
    }

    private static VmState ParseVmState(string? state)
    {
        return state switch
        {
            "0" or "Running" => VmState.Running,
            "1" or "Off" => VmState.Off,
            "2" or "Paused" => VmState.Paused,
            "3" or "Saved" => VmState.Saved,
            "4" or "Starting" => VmState.Starting,
            "5" or "Saving" => VmState.Saving,
            "6" or "Stopping" => VmState.Stopping,
            "7" or "Pausing" => VmState.Pausing,
            "8" or "Resuming" => VmState.Resuming,
            _ => VmState.Unknown
        };
    }

    private static SwitchType ParseSwitchType(string? type)
    {
        return type switch
        {
            "0" or "Internal" => SwitchType.Internal,
            "1" or "External" => SwitchType.External,
            "2" or "Private" => SwitchType.Private,
            _ => SwitchType.Unknown
        };
    }

    private static DiskType DetermineDiskType(string diskPath)
    {
        var extension = Path.GetExtension(diskPath)?.ToLowerInvariant();
        return extension switch
        {
            ".vhd" => DiskType.Vhd,
            ".vhdx" => DiskType.Vhdx,
            _ => DiskType.Unknown
        };
    }

    private static DateTimeOffset? ParseDateTime(string? dateStr)
    {
        if (string.IsNullOrEmpty(dateStr))
            return null;

        if (DateTimeOffset.TryParse(dateStr, out var dt))
            return dt;

        return null;
    }

    private static string ComputeDiskId(string vmId, string diskPath)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        var combined = $"{vmId}:{diskPath}";
        var hash = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(combined));
        return Convert.ToHexString(hash)[..16];
    }

    private List<BatchRecord> CreateHostRecords(HyperVInventory inventory, CollectionContext context)
    {
        var records = new List<BatchRecord>();
        var now = DateTimeOffset.UtcNow;

        var hostIdentifiers = new List<AssetIdentifier>
        {
            new("smbios_uuid", inventory.SmbiosUuid ?? inventory.HostId, "strong"),
            new("hostname", inventory.HostName, "strong"),
            new("hyperv_host", inventory.HostId, "strong")
        };

        // Host inventory record
        records.Add(new BatchRecord(
            RecordType: "inventory",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: inventory.HostId,
            AssetType: "HyperVHost",
            DisplayName: inventory.HostName,
            Identifiers: hostIdentifiers,
            Properties: new Dictionary<string, string>
            {
                ["hyperv_version"] = inventory.HyperVVersion ?? "unknown",
                ["processor_count"] = inventory.TotalProcessorCount.ToString(),
                ["total_memory_bytes"] = inventory.TotalMemoryBytes.ToString(),
                ["vm_count"] = inventory.VmCount.ToString(),
                ["running_vm_count"] = inventory.RunningVmCount.ToString()
            },
            Capabilities: new List<string> { "vm_monitoring", "host_monitoring" },
            MetricKey: null,
            ValueType: null,
            ValueDouble: null,
            ValueLong: null,
            ValueBoolean: null,
            ValueString: null,
            Unit: null,
            Quality: "good",
            Dimensions: null,
            Protocol: "wmi",
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
            Data: null
        ));

        // VM count metric
        records.Add(new BatchRecord(
            RecordType: "metric",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: inventory.HostId,
            AssetType: "HyperVHost",
            DisplayName: inventory.HostName,
            Identifiers: null,
            Properties: null,
            Capabilities: null,
            MetricKey: "hyperv.vm.count",
            ValueType: "long",
            ValueLong: inventory.VmCount,
            Quality: "good",
            Unit: "count",
            Dimensions: new Dictionary<string, string> { ["state"] = "total" },
            Protocol: "wmi",
            Data: null
        ));

        // Running VM count metric
        records.Add(new BatchRecord(
            RecordType: "metric",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: inventory.HostId,
            AssetType: "HyperVHost",
            DisplayName: inventory.HostName,
            Identifiers: null,
            Properties: null,
            Capabilities: null,
            MetricKey: "hyperv.vm.count",
            ValueType: "long",
            ValueLong: inventory.RunningVmCount,
            Quality: "good",
            Unit: "count",
            Dimensions: new Dictionary<string, string> { ["state"] = "running" },
            Protocol: "wmi",
            Data: null
        ));

        return records;
    }

    private List<BatchRecord> CreateVmRecords(VirtualMachine vm, string hostId, CollectionContext context)
    {
        var records = new List<BatchRecord>();
        var now = DateTimeOffset.UtcNow;

        var vmIdentifiers = new List<AssetIdentifier>
        {
            new("hyperv_vm_guid", vm.VmId, "strong"),
            new("vm_name", vm.VmName, "medium"),
            new("parent_host", hostId, "strong")
        };

        // VM inventory record
        records.Add(new BatchRecord(
            RecordType: "inventory",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: vm.VmId,
            AssetType: "HyperVVM",
            DisplayName: vm.VmName,
            Identifiers: vmIdentifiers,
            Properties: new Dictionary<string, string>
            {
                ["state"] = vm.State.ToString(),
                ["processor_count"] = vm.ProcessorCount.ToString(),
                ["assigned_memory_bytes"] = vm.AssignedMemoryBytes.ToString(),
                ["generation"] = vm.Generation ?? "unknown",
                ["disk_count"] = vm.DiskPaths.Count.ToString(),
                ["switch_count"] = vm.VirtualSwitchNames.Count.ToString()
            },
            Capabilities: new List<string> { "vm_metrics" },
            MetricKey: null,
            ValueType: null,
            ValueDouble: null,
            ValueLong: null,
            ValueBoolean: null,
            ValueString: null,
            Unit: null,
            Quality: "good",
            Dimensions: null,
            Protocol: "wmi",
            Result: null,
            StartedAt: vm.LastStartTime,
            FinishedAt: null,
            DurationMs: null,
            RetryCount: null,
            ErrorCode: null,
            Details: null,
            EventType: null,
            Severity: null,
            Message: null,
            Data: null
        ));

        // VM state metric
        records.Add(new BatchRecord(
            RecordType: "metric",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: vm.VmId,
            AssetType: "HyperVVM",
            DisplayName: vm.VmName,
            Identifiers: null,
            Properties: null,
            Capabilities: null,
            MetricKey: "hyperv.vm.state",
            ValueType: "string",
            ValueString: vm.State.ToString(),
            Quality: "good",
            Dimensions: null,
            Protocol: "wmi",
            Data: null
        ));

        // Memory assigned metric
        records.Add(new BatchRecord(
            RecordType: "metric",
            RecordId: Guid.NewGuid(),
            ObservedAt: now,
            LocalAssetId: vm.VmId,
            AssetType: "HyperVVM",
            DisplayName: vm.VmName,
            Identifiers: null,
            Properties: null,
            Capabilities: null,
            MetricKey: "hyperv.vm.memory.assigned",
            ValueType: "long",
            ValueLong: vm.AssignedMemoryBytes,
            Quality: "good",
            Unit: "bytes",
            Dimensions: null,
            Protocol: "wmi",
            Data: null
        ));

        return records;
    }

    private List<BatchRecord> CreateVmMetricRecords(VmMetrics metrics, CollectionContext context)
    {
        var records = new List<BatchRecord>();
        var now = DateTimeOffset.UtcNow;

        // CPU usage metric
        if (metrics.CpuQuality != MetricQuality.Unsupported)
        {
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: now,
                LocalAssetId: metrics.VmId,
                AssetType: "HyperVVM",
                DisplayName: metrics.VmName,
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "hyperv.vm.cpu.usage",
                ValueType: "double",
                ValueDouble: metrics.CpuUsagePercent,
                Quality: metrics.CpuQuality.ToString().ToLowerInvariant(),
                Unit: "percent",
                Dimensions: null,
                Protocol: "wmi",
                Data: null
            ));
        }

        // Memory usage metric
        if (metrics.MemoryQuality != MetricQuality.Unsupported)
        {
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: now,
                LocalAssetId: metrics.VmId,
                AssetType: "HyperVVM",
                DisplayName: metrics.VmName,
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "hyperv.vm.memory.usage",
                ValueType: "double",
                ValueDouble: metrics.MemoryUsagePercent,
                Quality: metrics.MemoryQuality.ToString().ToLowerInvariant(),
                Unit: "percent",
                Dimensions: null,
                Protocol: "wmi",
                Data: null
            ));
        }

        // Uptime metric
        if (metrics.UptimeQuality != MetricQuality.Unsupported)
        {
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: now,
                LocalAssetId: metrics.VmId,
                AssetType: "HyperVVM",
                DisplayName: metrics.VmName,
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "hyperv.vm.uptime",
                ValueType: "long",
                ValueLong: metrics.UptimeSeconds,
                Quality: metrics.UptimeQuality.ToString().ToLowerInvariant(),
                Unit: "seconds",
                Dimensions: null,
                Protocol: "wmi",
                Data: null
            ));
        }

        // Network throughput metric
        if (metrics.NetworkQuality != MetricQuality.Unsupported)
        {
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: now,
                LocalAssetId: metrics.VmId,
                AssetType: "HyperVVM",
                DisplayName: metrics.VmName,
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "hyperv.vm.network.throughput",
                ValueType: "double",
                ValueDouble: metrics.NetworkBytesPerSecond,
                Quality: metrics.NetworkQuality.ToString().ToLowerInvariant(),
                Unit: "bytes_per_second",
                Dimensions: null,
                Protocol: "wmi",
                Data: null
            ));
        }

        // Disk throughput metric
        if (metrics.DiskQuality != MetricQuality.Unsupported)
        {
            records.Add(new BatchRecord(
                RecordType: "metric",
                RecordId: Guid.NewGuid(),
                ObservedAt: now,
                LocalAssetId: metrics.VmId,
                AssetType: "HyperVVM",
                DisplayName: metrics.VmName,
                Identifiers: null,
                Properties: null,
                Capabilities: null,
                MetricKey: "hyperv.vm.disk.throughput",
                ValueType: "double",
                ValueDouble: metrics.DiskBytesPerSecond,
                Quality: metrics.DiskQuality.ToString().ToLowerInvariant(),
                Unit: "bytes_per_second",
                Dimensions: null,
                Protocol: "wmi",
                Data: null
            ));
        }

        return records;
    }
}
