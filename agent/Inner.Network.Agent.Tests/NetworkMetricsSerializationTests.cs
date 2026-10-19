using Inner.Network.Agent.Workers;
using Inner.Network.Agent.Transport;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkMetricsSerializationTests
{
    [Fact]
    public void Production_serializer_matches_sanitized_success_partial_and_known_timeout_fixture()
    {
        var observed = DateTimeOffset.Parse("2026-10-19T12:00:00Z");
        var batch = new NetworkMetricBatch(7, observed,
        [
            new("00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000001", "192.0.2.1", "switch-a", "Switch", observed, "success",
                SysObjectId: "1.3.6.1.4.1.9", SysDescription: "Lab switch", SysContact: "noc@example.invalid",
                Manufacturer: "Example Networks", Model: "EX-24", SerialNumber: "LAB-1001", FirmwareVersion: "1.2.3", EngineId: "80004fb805060102",
                Interfaces: [new(1, "ge-0/0/1", "Uplink", "00:11:22:33:44:55", 1, 1, 1000000000, "4294967298", "9007199254741001", "2", "3", "4", "5", 2048, 512, IfType: 6)]),
            new("00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000002", "192.0.2.2", "ap-b", "Access point", observed, "partial",
                SysDescription: "Wireless device", Interfaces: []),
            new("00000000-0000-4000-8000-000000000010", "00000000-0000-4000-8000-000000000003", "192.0.2.3", "192.0.2.3", "Outro", observed, "timeout", Interfaces: [])
        ]);

        var expected = File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "network-metrics-v1.json")).Trim();
        var actual = NetworkMetricsJson.Serialize(batch);
        Assert.Equal(expected, actual);
    }
}
