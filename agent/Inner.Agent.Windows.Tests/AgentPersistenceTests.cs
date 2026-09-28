using Inner.Agent.Windows.Contracts;
using Inner.Agent.Windows.Persistence;
using Inner.Agent.Windows.Security;
using Xunit;

namespace Inner.Agent.Windows.Tests;

public sealed class AgentPersistenceTests
{
    [Fact]
    public async Task OutboxPersistsPendingBatchAndMarksItAccepted()
    {
        var directory = CreateTempDirectory();
        await using var outbox = new SqliteAgentOutbox(directory);
        await outbox.InitializeAsync(CancellationToken.None);

        var batch = new MetricBatch(
            0,
            DateTimeOffset.UtcNow,
            new HostMetrics("HV-01", 20, 40, 1024, 400, 30, 100),
            Array.Empty<VirtualMachineMetrics>());

        var sequence = await outbox.EnqueueAsync(batch, CancellationToken.None);
        var pending = await outbox.GetPendingAsync(10, CancellationToken.None);

        Assert.Equal(1, sequence);
        Assert.Single(pending);
        Assert.Equal(sequence, pending[0].Sequence);

        await outbox.MarkAcceptedAsync(sequence, CancellationToken.None);

        Assert.Empty(await outbox.GetPendingAsync(10, CancellationToken.None));
        var status = await outbox.GetStatusAsync(CancellationToken.None);
        Assert.Equal(sequence, status.LastCreatedSequence);
        Assert.Equal(sequence, status.LastAcceptedSequence);
    }

    [Fact]
    public async Task QuarantinesPermanentFailureWithoutBlockingLaterBatches()
    {
        var directory = CreateTempDirectory();
        await using var outbox = new SqliteAgentOutbox(directory);
        await outbox.InitializeAsync(CancellationToken.None);

        var batch = new MetricBatch(
            0,
            DateTimeOffset.UtcNow,
            new HostMetrics("HV-01", 20, 40, 1024, 400, 30, 100),
            Array.Empty<VirtualMachineMetrics>());

        var first = await outbox.EnqueueAsync(batch, CancellationToken.None);
        var second = await outbox.EnqueueAsync(batch, CancellationToken.None);

        await outbox.MarkRejectedAsync(first, "invalid payload", CancellationToken.None);
        var pending = await outbox.GetPendingAsync(10, CancellationToken.None);

        Assert.Single(pending);
        Assert.Equal(second, pending[0].Sequence);
    }

    [Fact]
    public async Task DefersTransientFailureWithDurableRetryMetadata()
    {
        var directory = CreateTempDirectory();
        await using var outbox = new SqliteAgentOutbox(directory);
        await outbox.InitializeAsync(CancellationToken.None);

        var sequence = await outbox.EnqueueAsync(new MetricBatch(
            0,
            DateTimeOffset.UtcNow,
            new HostMetrics("HV-01", 20, 40, 1024, 400, 30, 100),
            Array.Empty<VirtualMachineMetrics>()), CancellationToken.None);

        await outbox.MarkRetryAsync(sequence, TimeSpan.FromHours(1), "temporarily unavailable", CancellationToken.None);

        Assert.Empty(await outbox.GetPendingAsync(10, CancellationToken.None));
    }

    [Fact]
    public void DpapiSecretStoreRoundTripsAndDoesNotStorePlaintext()
    {
        var directory = CreateTempDirectory();
        var store = new DpapiSecretStore(directory);
        const string secret = "refresh-token-value";

        store.Save("credentials", secret);

        Assert.Equal(secret, store.Read("credentials"));
        Assert.NotEqual(secret, File.ReadAllText(Path.Combine(directory, "credentials.bin")));
    }

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), "inner-agent-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(path);
        return path;
    }
}
