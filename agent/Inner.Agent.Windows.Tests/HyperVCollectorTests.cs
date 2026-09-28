using Inner.Agent.Windows.Collectors;
using Inner.Agent.Windows.Contracts;
using Xunit;

namespace Inner.Agent.Windows.Tests;

public sealed class HyperVCollectorTests
{
    [Theory]
    [InlineData("2", HyperVState.Running)]
    [InlineData("Running", HyperVState.Running)]
    [InlineData("3", HyperVState.Off)]
    [InlineData("32768", HyperVState.Paused)]
    [InlineData("Paused", HyperVState.Paused)]
    [InlineData("unknown", HyperVState.Off)]
    public void MapsHyperVState(string rawState, HyperVState expected)
    {
        Assert.Equal(expected, HyperVStateParser.Parse(rawState));
    }

    [Fact]
    public void ConvertsHyperVByteCountersToContractUnits()
    {
        Assert.Equal(4, HyperVValueMapper.BytesToMegabytes(4L * 1024 * 1024));
        Assert.Null(HyperVValueMapper.BytesToMegabytes(null));
        Assert.Equal(75, HyperVValueMapper.PercentOrNull(75));
        Assert.Null(HyperVValueMapper.PercentOrNull(-1));
    }
}
