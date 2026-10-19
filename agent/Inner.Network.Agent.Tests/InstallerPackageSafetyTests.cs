using Inner.Network.Agent.Setup;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class InstallerPackageSafetyTests
{
    [Theory]
    [InlineData("agent.exe", true)]
    [InlineData("nested/appsettings.json", true)]
    [InlineData("../outside.txt", false)]
    [InlineData("..\\outside.txt", false)]
    [InlineData("C:\\outside.txt", false)]
    public void Package_entries_must_stay_under_staging_root(string entry, bool expected)
    {
        var root = Path.Combine(Path.GetTempPath(), "network-agent-test-root");
        Assert.Equal(expected, InstallerPackageSafety.IsSafeEntry(root, entry));
    }

    [Fact]
    public void Reads_service_issued_snake_case_pairing_status()
    {
        const string json = "{\"state\":\"pending\",\"code\":\"NW-AB12-CD34\",\"expires_at\":\"2026-10-19T14:00:00Z\",\"verification_url\":\"https://portal.example/pair\"}";

        var status = InstallerPackageSafety.ParseStatus(json);

        Assert.NotNull(status);
        Assert.Equal("pending", status.State);
        Assert.Equal("NW-AB12-CD34", status.Code);
        Assert.Equal(DateTimeOffset.Parse("2026-10-19T14:00:00Z"), status.ExpiresAt);
        Assert.Equal("https://portal.example/pair", status.VerificationUrl);
    }
}
