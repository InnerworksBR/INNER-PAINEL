using Inner.Monitoring.Contracts.Collectors;
using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Application;

/// <summary>
///     Interface para coletor de métricas Hyper-V.
/// </summary>
public interface IHyperVCollector : IObservationCollector
{
    /// <summary>
    ///     Obtém inventário completo do host Hyper-V.
    /// </summary>
    Task<HyperVInventory> GetInventoryAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém métricas de todas as VMs.
    /// </summary>
    Task<IEnumerable<VmMetrics>> GetVmMetricsAsync(CancellationToken ct);

    /// <summary>
    ///     Verifica se Hyper-V está disponível no host.
    /// </summary>
    Task<bool> IsAvailableAsync(CancellationToken ct);
}

/// <summary>
///     Inventário do host Hyper-V.
/// </summary>
public sealed class HyperVInventory
{
    public required string HostId { get; init; }
    public required string HostName { get; init; }
    public string? SmbiosUuid { get; init; }
    public string? HyperVVersion { get; init; }
    public int TotalProcessorCount { get; init; }
    public long TotalMemoryBytes { get; init; }
    public int VmCount { get; init; }
    public int RunningVmCount { get; init; }
    public IReadOnlyList<VirtualMachine> VirtualMachines { get; init; } = [];
    public IReadOnlyList<VirtualSwitch> VirtualSwitches { get; init; } = [];
    public IReadOnlyList<VirtualDisk> VirtualDisks { get; init; } = [];
    public DateTimeOffset CollectedAt { get; init; }
    public bool IsAvailable { get; init; }
    public string? UnavailableReason { get; init; }
}

/// <summary>
///     Máquina virtual Hyper-V.
/// </summary>
public sealed class VirtualMachine
{
    public required string VmId { get; init; }
    public required string VmName { get; init; }
    public required VmState State { get; init; }
    public int ProcessorCount { get; init; }
    public long AssignedMemoryBytes { get; init; }
    public DateTimeOffset? CreationTime { get; init; }
    public DateTimeOffset? LastStartTime { get; init; }
    public string? Generation { get; init; }
    public IReadOnlyList<string> VirtualSwitchNames { get; init; } = [];
    public IReadOnlyList<string> DiskPaths { get; init; } = [];
    public Guid? SourceId { get; init; }
}

/// <summary>
///     Estado de uma VM Hyper-V.
/// </summary>
public enum VmState
{
    Unknown,
    Running,
    Off,
    Paused,
    Saved,
    Starting,
    Saving,
    Stopping,
    Pausing,
    Resuming
}

/// <summary>
///     Switch virtual Hyper-V.
/// </summary>
public sealed class VirtualSwitch
{
    public required string SwitchId { get; init; }
    public required string SwitchName { get; init; }
    public required SwitchType Type { get; init; }
    public IReadOnlyList<string> ConnectedVmIds { get; init; } = [];
    public IReadOnlyList<SwitchPort> Ports { get; init; } = [];
}

/// <summary>
///     Tipo de switch virtual.
/// </summary>
public enum SwitchType
{
    Unknown,
    Internal,
    External,
    Private
}

/// <summary>
///     Porta de um switch virtual.
/// </summary>
public sealed class SwitchPort
{
    public required string PortId { get; init; }
    public required string PortName { get; init; }
    public required string ConnectedVmId { get; init; }
    public string? ConnectedVmName { get; init; }
}

/// <summary>
///     Disco virtual Hyper-V.
/// </summary>
public sealed class VirtualDisk
{
    public required string DiskId { get; init; }
    public required string VmId { get; init; }
    public required string DiskPath { get; init; }
    public required DiskType Type { get; init; }
    public long CapacityBytes { get; init; }
    public long? CurrentSizeBytes { get; init; }
}

/// <summary>
///     Tipo de disco virtual.
/// </summary>
public enum DiskType
{
    Unknown,
    Vhd,
    Vhdx,
    PassThrough
}

/// <summary>
///     Métricas de uma VM Hyper-V.
/// </summary>
public sealed class VmMetrics
{
    public required string VmId { get; init; }
    public required string VmName { get; init; }
    public required VmState State { get; init; }
    public double CpuUsagePercent { get; init; }
    public MetricQuality CpuQuality { get; init; } = MetricQuality.Good;
    public long MemoryAssignedBytes { get; init; }
    public long MemoryObservedBytes { get; init; }
    public MetricQuality MemoryQuality { get; init; } = MetricQuality.Good;
    public double MemoryUsagePercent { get; init; }
    public long UptimeSeconds { get; init; }
    public MetricQuality UptimeQuality { get; init; } = MetricQuality.Good;
    public double NetworkBytesPerSecond { get; init; }
    public MetricQuality NetworkQuality { get; init; } = MetricQuality.Good;
    public double DiskBytesPerSecond { get; init; }
    public MetricQuality DiskQuality { get; init; } = MetricQuality.Good;
    public DateTimeOffset CollectedAt { get; init; }
}
