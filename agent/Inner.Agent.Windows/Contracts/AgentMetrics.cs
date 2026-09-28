namespace Inner.Agent.Windows.Contracts;

public enum HyperVState
{
    Running,
    Off,
    Paused
}

public sealed record HostMetrics(
    string Hostname,
    double CpuPercent,
    double MemoryPercent,
    double MemoryTotalMb,
    double MemoryUsedMb,
    double DiskPercent,
    long UptimeSeconds);

public sealed record VirtualMachineMetrics(
    string HyperVId,
    string Name,
    HyperVState State,
    double? CpuPercent,
    double? MemoryAssignedMb,
    double? MemoryUsedMb,
    long? UptimeSeconds,
    double? VirtualDiskSizeGb);

public sealed record MetricBatch(
    long Sequence,
    DateTimeOffset CollectedAt,
    HostMetrics Host,
    IReadOnlyList<VirtualMachineMetrics> VirtualMachines);
