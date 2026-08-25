using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Agent.Windows;

/// <summary>
///     Interface para outbox local (offline-first).
/// </summary>
public interface IOutbox
{
    /// <summary>
    ///     Cria um batch na outbox local.
    /// </summary>
    Task<BatchSubmission> CreateBatchAsync(
        IReadOnlyList<BatchRecord> records,
        DateTimeOffset collectedFrom,
        DateTimeOffset collectedTo,
        CancellationToken ct);

    /// <summary>
    ///     Obtém batches pendentes.
    /// </summary>
    Task<List<(BatchSubmission Batch, string Payload)>> GetPendingBatchesAsync(CancellationToken ct);

    /// <summary>
    ///     Marca batch como enviado.
    /// </summary>
    Task MarkBatchSentAsync(Guid batchId, string? responseJson, CancellationToken ct);

    /// <summary>
    ///     Obtém o status da outbox.
    /// </summary>
    Task<OutboxStatus> GetStatusAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém a próxima sequência disponível.
    /// </summary>
    Task<long> GetNextSequenceAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém a última sequência confirmada.
    /// </summary>
    Task<long> GetLastAckedSequenceAsync(CancellationToken ct);

    /// <summary>
    ///     Atualiza sequência confirmada.
    /// </summary>
    Task UpdateAckedSequenceAsync(long sequence, CancellationToken ct);

    /// <summary>
    ///     Remove batches antigos da outbox.
    /// </summary>
    Task PurgeOldBatchesAsync(int maxAgeSeconds, CancellationToken ct);
}
