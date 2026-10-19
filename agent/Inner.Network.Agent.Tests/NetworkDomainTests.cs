using System.Net;
using Inner.Network.Agent.Discovery;
using Inner.Network.Agent.Metrics;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkDomainTests
{
    [Fact]
    public void ExpandDistinct_deduplicates_overlapping_ranges()
    {
        var ranges = new NetworkRangePlanner(maxAddresses: 4096);

        var expanded = ranges.ExpandDistinct(["192.168.10.0/24", "192.168.10.0/25"]);

        Assert.Equal(expanded.Count, expanded.Distinct().Count());
        Assert.Equal(254, expanded.Count);
    }

    [Fact]
    public void ExpandDistinct_rejects_ranges_over_budget_instead_of_truncating()
    {
        var ranges = new NetworkRangePlanner(maxAddresses: 2);

        Assert.Throws<InvalidOperationException>(() => ranges.ExpandDistinct(["192.168.1.0/29"]));
    }

    [Fact]
    public void Calculate_suppresses_rates_after_device_reboot_or_counter_reset()
    {
        var calculator = new InterfaceRateCalculator();

        Assert.Null(calculator.Calculate(previousOctets: 1000, currentOctets: 10, elapsedSeconds: 60, restarted: true));
        Assert.Null(calculator.Calculate(previousOctets: 1000, currentOctets: 10, elapsedSeconds: 60, restarted: false));
    }

    [Fact]
    public void Calculate_returns_null_for_invalid_elapsed_interval()
    {
        Assert.Null(new InterfaceRateCalculator().Calculate(1, 100, 0, restarted: false));
    }
}
