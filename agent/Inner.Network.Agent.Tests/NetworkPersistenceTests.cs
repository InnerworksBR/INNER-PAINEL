using Inner.Network.Agent.Persistence;
using Xunit;

namespace Inner.Network.Agent.Tests;

public sealed class NetworkPersistenceTests
{
    [Fact]
    public async Task Store_preserves_identity_sequence_config_and_outbox_across_reopen()
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-{Guid.NewGuid():N}.db");
        try
        {
            Guid deviceId;
            long sequence;
            string machineId;
            await using (var store = new NetworkAgentStore(path, 10_000_000, 1000))
            {
                await store.InitializeAsync();
                deviceId = await store.GetOrCreateDeviceIdAsync("scope-a", "192.168.1.10", "engine-a");
                sequence = await store.NextSequenceAsync();
                machineId = await store.GetOrCreateMachineIdAsync();
                await store.SaveConfigurationAsync("{\"version\":4}");
                await store.EnqueueAsync(sequence, "{\"sequence\":1,\"devices\":[]}");
                Assert.NotEqual(Guid.Empty, Guid.Parse(machineId));
            }

            await using (var reopened = new NetworkAgentStore(path, 10_000_000, 1000))
            {
                await reopened.InitializeAsync();
                Assert.Equal(deviceId, await reopened.GetOrCreateDeviceIdAsync("scope-a", "192.168.1.10", "engine-a"));
                Assert.Equal(sequence + 1, await reopened.NextSequenceAsync());
                Assert.Equal(machineId, await reopened.GetOrCreateMachineIdAsync());
                Assert.Equal("{\"version\":4}", await reopened.ReadConfigurationAsync());
                Assert.Single(await reopened.ReadPendingAsync(10));
            }
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
            if (File.Exists(path + "-shm")) File.Delete(path + "-shm");
            if (File.Exists(path + "-wal")) File.Delete(path + "-wal");
        }
    }

    [Fact]
    public async Task Enqueue_refuses_to_silently_exceed_outbox_limits()
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path, maxBytes: 1, maxBatches: 1);
            await store.InitializeAsync();
            await Assert.ThrowsAsync<InvalidOperationException>(() => store.EnqueueAsync(1, "too large"));
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
            if (File.Exists(path + "-shm")) File.Delete(path + "-shm");
            if (File.Exists(path + "-wal")) File.Delete(path + "-wal");
        }
    }

    [Fact]
    public async Task Counter_history_identifies_device_reboot_and_counter_reset()
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            Assert.Null(await store.RecordCounterAsync("device-1", 1, "in", 1000, 5000, DateTimeOffset.UtcNow));
            var normal = await store.RecordCounterAsync("device-1", 1, "in", 1600, 6000, DateTimeOffset.UtcNow);
            Assert.Equal(1000UL, normal!.Octets);
            Assert.False(normal.Restarted);
            var reboot = await store.RecordCounterAsync("device-1", 1, "in", 10, 100, DateTimeOffset.UtcNow);
            Assert.Equal(1600UL, reboot!.Octets);
            Assert.True(reboot.Restarted);
        }
        finally
        {
            if (File.Exists(path)) File.Delete(path);
            if (File.Exists(path + "-shm")) File.Delete(path + "-shm");
            if (File.Exists(path + "-wal")) File.Delete(path + "-wal");
        }
    }

    [Fact]
    public async Task Outbox_status_reports_created_acknowledged_and_pending_counters()
    {
        var path = Path.Combine(Path.GetTempPath(), $"network-agent-status-{Guid.NewGuid():N}.db");
        try
        {
            await using var store = new NetworkAgentStore(path);
            await store.InitializeAsync();
            var sequence = await store.NextSequenceAsync();
            const string payload = "{\"sequence\":1}";
            await store.EnqueueAsync(sequence, payload);

            var pending = await store.GetOutboxStatusAsync();
            Assert.Equal(sequence, pending.CreatedSequence);
            Assert.Equal(0, pending.AcknowledgedSequence);
            Assert.Equal(1, pending.PendingCount);
            Assert.Equal(System.Text.Encoding.UTF8.GetByteCount(payload), pending.PendingBytes);

            await store.AcknowledgeAsync(sequence);
            var acknowledged = await store.GetOutboxStatusAsync();
            Assert.Equal(sequence, acknowledged.AcknowledgedSequence);
            Assert.Equal(0, acknowledged.PendingCount);
            Assert.Equal(0, acknowledged.PendingBytes);
        }
        finally
        {
            foreach (var file in new[] { path, path + "-shm", path + "-wal" }) if (File.Exists(file)) File.Delete(file);
        }
    }
}
