using Inner.Agent.Windows;
using Inner.Agent.Windows.Contracts;
using Xunit;

namespace Inner.Agent.Windows.Tests;

public sealed class MetricBatchContractTests
{
    [Fact]
    public void AcceptsHostAndVmBatch()
    {
        var batch = new MetricBatch(
            Sequence: 1,
            CollectedAt: DateTimeOffset.Parse("2026-09-28T12:00:00Z"),
            Host: new HostMetrics("HV-01", 21.5, 60, 65_536, 39_321, 44, 7200),
            VirtualMachines: new[]
            {
                new VirtualMachineMetrics("vm-1", "APP-01", HyperVState.Running, 12, 4096, 2500, 600, 80)
            });

        var normalized = MetricBatchContract.Validate(batch);

        Assert.Equal("HV-01", normalized.Host.Hostname);
        Assert.Single(normalized.VirtualMachines);
        Assert.Equal(HyperVState.Running, normalized.VirtualMachines[0].State);
    }

    [Fact]
    public void RejectsInvalidPercentagesAndNegativeCounters()
    {
        var batch = new MetricBatch(
            1,
            DateTimeOffset.UtcNow,
            new HostMetrics("HV-01", 101, 40, 1, 1, 20, -1),
            Array.Empty<VirtualMachineMetrics>());

        var error = Assert.Throws<MetricContractException>(() => MetricBatchContract.Validate(batch));

        Assert.Contains("host.cpu_percent", error.Message);
    }

    [Fact]
    public void MachineIdentityIsStableForTheSameInputs()
    {
        var first = MachineIdentity.Create("machine-guid", "HV-01");
        var second = MachineIdentity.Create("machine-guid", "HV-01");

        Assert.Equal(first, second);
        Assert.Equal(64, first.Length);
    }
}
