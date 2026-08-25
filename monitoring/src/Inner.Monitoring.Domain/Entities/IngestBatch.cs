using System.Text.Json;
using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Batch de ingestão recebido.
/// </summary>
public sealed class IngestBatch
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SourceId { get; private set; }
    public Guid BatchId { get; private set; }
    public long Sequence { get; private set; }
    public int SchemaVersion { get; private set; }
    public string SourceVersion { get; private set; } = string.Empty;
    public byte[] ContentSha256 { get; private set; } = Array.Empty<byte>();
    public int RecordCount { get; private set; }
    public int CompressedBytes { get; private set; }
    public int UncompressedBytes { get; private set; }
    public DateTimeOffset CollectedFrom { get; private set; }
    public DateTimeOffset CollectedTo { get; private set; }
    public DateTimeOffset SentAt { get; private set; }
    public DateTimeOffset ReceivedAt { get; private set; }
    public JsonDocument? Payload { get; private set; }
    public BatchStatus Status { get; private set; } = BatchStatus.Received;
    public int ProcessingAttempts { get; private set; }
    public DateTimeOffset? ProcessedAt { get; private set; }
    public string? LastErrorCode { get; private set; }
    public string? LastErrorDetail { get; private set; }

    private IngestBatch() { }

    public static IngestBatch Create(
        Guid companyId,
        Guid sourceId,
        Guid batchId,
        long sequence,
        int schemaVersion,
        string sourceVersion,
        byte[] contentSha256,
        int recordCount,
        int compressedBytes,
        int uncompressedBytes,
        DateTimeOffset collectedFrom,
        DateTimeOffset collectedTo,
        DateTimeOffset sentAt,
        JsonDocument payload)
    {
        return new IngestBatch
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SourceId = sourceId,
            BatchId = batchId,
            Sequence = sequence,
            SchemaVersion = schemaVersion,
            SourceVersion = sourceVersion,
            ContentSha256 = contentSha256,
            RecordCount = recordCount,
            CompressedBytes = compressedBytes,
            UncompressedBytes = uncompressedBytes,
            CollectedFrom = collectedFrom,
            CollectedTo = collectedTo,
            SentAt = sentAt,
            ReceivedAt = DateTimeOffset.UtcNow,
            Payload = payload,
            Status = BatchStatus.Received
        };
    }

    public void MarkProcessing()
    {
        Status = BatchStatus.Processing;
    }

    public void MarkProcessed()
    {
        Status = BatchStatus.Processed;
        ProcessedAt = DateTimeOffset.UtcNow;
    }

    public void MarkRetrying(string errorCode, string? errorDetail = null)
    {
        Status = BatchStatus.Retrying;
        ProcessingAttempts++;
        LastErrorCode = errorCode;
        LastErrorDetail = errorDetail;
    }

    public void MarkDeadLetter(string errorCode, string? errorDetail = null)
    {
        Status = BatchStatus.DeadLetter;
        LastErrorCode = errorCode;
        LastErrorDetail = errorDetail;
    }

    public void MarkArchived()
    {
        Status = BatchStatus.Archived;
    }
}
