using Inner.Agent.Windows.Contracts;

namespace Inner.Agent.Windows.Persistence;

public sealed record PendingMetric(long Sequence, string Payload, DateTimeOffset CreatedAt);

public sealed record OutboxStatus(
    int PendingCount,
    long PendingBytes,
    long LastCreatedSequence,
    long LastAcceptedSequence);

public interface IAgentOutbox : IAsyncDisposable
{
    Task InitializeAsync(CancellationToken cancellationToken);
    Task<long> EnqueueAsync(MetricBatch batch, CancellationToken cancellationToken);
    Task<IReadOnlyList<PendingMetric>> GetPendingAsync(int limit, CancellationToken cancellationToken);
    Task MarkAcceptedAsync(long sequence, CancellationToken cancellationToken);
    Task<OutboxStatus> GetStatusAsync(CancellationToken cancellationToken);
}
