using System.Threading.Channels;

namespace Inner.Monitoring.Cloud.Api;

/// <summary>
///     Fila de processamento de batches.
/// </summary>
public class BatchProcessingQueue
{
    private readonly Channel<Guid> _channel;

    public BatchProcessingQueue()
    {
        _channel = Channel.CreateUnbounded<Guid>(new UnboundedChannelOptions
        {
            SingleReader = true,
            SingleWriter = false
        });
    }

    public ValueTask EnqueueAsync(Guid batchId, CancellationToken cancellationToken = default)
    {
        return _channel.Writer.WriteAsync(batchId, cancellationToken);
    }

    public async ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken)
    {
        return await _channel.Reader.ReadAsync(cancellationToken);
    }

    public bool TryPeek(out Guid batchId)
    {
        return _channel.Reader.TryPeek(out batchId);
    }

    public int Count => _channel.Reader.Count;
}
