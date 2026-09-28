namespace Inner.Agent.Windows.Contracts;

public sealed class MetricContractException : Exception
{
    public MetricContractException(string message) : base(message)
    {
    }
}

public static class MetricBatchContract
{
    private const int MaxVirtualMachines = 500;

    public static MetricBatch Validate(MetricBatch batch)
    {
        ArgumentNullException.ThrowIfNull(batch);

        if (batch.Sequence < 0) throw new MetricContractException("sequence must be non-negative");
        if (batch.CollectedAt == default) throw new MetricContractException("collected_at is required");
        if (batch.Host is null) throw new MetricContractException("host is required");
        if (batch.VirtualMachines is null) throw new MetricContractException("virtual_machines is required");
        if (batch.VirtualMachines.Count > MaxVirtualMachines) throw new MetricContractException("too many virtual machines");

        ValidateHost(batch.Host);
        foreach (var vm in batch.VirtualMachines) ValidateVm(vm);

        return batch with
        {
            CollectedAt = batch.CollectedAt.ToUniversalTime(),
            Host = batch.Host with { Hostname = batch.Host.Hostname.Trim() },
            VirtualMachines = batch.VirtualMachines
                .Select(vm => vm with { HyperVId = vm.HyperVId.Trim(), Name = vm.Name.Trim() })
                .ToArray()
        };
    }

    private static void ValidateHost(HostMetrics host)
    {
        if (string.IsNullOrWhiteSpace(host.Hostname)) throw new MetricContractException("host.hostname is required");
        ValidatePercentage(host.CpuPercent, "host.cpu_percent");
        ValidatePercentage(host.MemoryPercent, "host.memory_percent");
        ValidateNonNegative(host.MemoryTotalMb, "host.memory_total_mb");
        ValidateNonNegative(host.MemoryUsedMb, "host.memory_used_mb");
        ValidatePercentage(host.DiskPercent, "host.disk_percent");
        if (host.UptimeSeconds < 0) throw new MetricContractException("host.uptime_seconds must be non-negative");
    }

    private static void ValidateVm(VirtualMachineMetrics vm)
    {
        if (vm is null) throw new MetricContractException("virtual machine cannot be null");
        if (string.IsNullOrWhiteSpace(vm.HyperVId) || string.IsNullOrWhiteSpace(vm.Name))
            throw new MetricContractException("virtual machine identity is required");

        if (vm.CpuPercent.HasValue) ValidatePercentage(vm.CpuPercent.Value, "vm.cpu_percent");
        if (vm.MemoryAssignedMb.HasValue) ValidateNonNegative(vm.MemoryAssignedMb.Value, "vm.memory_assigned_mb");
        if (vm.MemoryUsedMb.HasValue) ValidateNonNegative(vm.MemoryUsedMb.Value, "vm.memory_used_mb");
        if (vm.UptimeSeconds is < 0) throw new MetricContractException("vm.uptime_seconds must be non-negative");
        if (vm.VirtualDiskSizeGb.HasValue) ValidateNonNegative(vm.VirtualDiskSizeGb.Value, "vm.virtual_disk_size_gb");
    }

    private static void ValidatePercentage(double value, string field)
    {
        ValidateNonNegative(value, field);
        if (value > 100) throw new MetricContractException($"{field} must be between 0 and 100");
    }

    private static void ValidateNonNegative(double value, string field)
    {
        if (double.IsNaN(value) || double.IsInfinity(value) || value < 0)
            throw new MetricContractException($"{field} must be finite and non-negative");
    }
}
