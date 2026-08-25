using System.Collections.Immutable;

namespace Inner.Monitoring.Contracts.Records;

/// <summary>
///     Envelope de um batch de métricas enviado pela source.
/// </summary>
/// <param name="SchemaVersion">Versão do schema do payload.</param>
/// <param name="BatchId">UUID único do batch.</param>
/// <param name="Sequence">Número de sequência monotônico.</param>
/// <param name="SourceVersion">Versão da source que enviou.</param>
/// <param name="SentAt">Timestamp de envio.</param>
/// <param name="CollectedFrom">Início do período de coleta.</param>
/// <param name="CollectedTo">Fim do período de coleta.</param>
/// <param name="Records">Registros do batch.</param>
public sealed record BatchSubmission(
    int SchemaVersion,
    Guid BatchId,
    long Sequence,
    string SourceVersion,
    DateTimeOffset SentAt,
    DateTimeOffset CollectedFrom,
    DateTimeOffset CollectedTo,
    IReadOnlyList<BatchRecord> Records);

/// <summary>
///     Tipos de registro em um batch.
/// </summary>
public sealed record BatchRecord(
    string RecordType,
    Guid RecordId,
    DateTimeOffset ObservedAt,
    string LocalAssetId,
    string? AssetType = null,
    string? DisplayName = null,
    IReadOnlyList<AssetIdentifier>? Identifiers = null,
    IReadOnlyDictionary<string, string>? Properties = null,
    IReadOnlyList<string>? Capabilities = null,
    string? MetricKey = null,
    string? ValueType = null,
    double? ValueDouble = null,
    long? ValueLong = null,
    bool? ValueBoolean = null,
    string? ValueString = null,
    string? Unit = null,
    string? Quality = null,
    IReadOnlyDictionary<string, string>? Dimensions = null,
    string? Protocol = null,
    string? Result = null,
    DateTimeOffset? StartedAt = null,
    DateTimeOffset? FinishedAt = null,
    int? DurationMs = null,
    int? RetryCount = null,
    string? ErrorCode = null,
    IReadOnlyDictionary<string, string>? Details = null,
    string? EventType = null,
    string? Severity = null,
    string? Message = null,
    IReadOnlyDictionary<string, object>? Data = null);

/// <summary>
///     Identificador de um asset.
/// </summary>
/// <param name="Type">Tipo do identificador.</param>
/// <param name="Value">Valor normalizado.</param>
/// <param name="Confidence">Nível de confiança.</param>
public sealed record AssetIdentifier(
    string Type,
    string Value,
    string Confidence);

/// <summary>
///     Response do ACK de batch.
/// </summary>
/// <param name="Status">Status: "accepted" ou "duplicate".</param>
/// <param name="BatchId">UUID do batch.</param>
/// <param name="Sequence">Número de sequência.</param>
/// <param name="PersistedAt">Timestamp de persistência.</param>
/// <param name="HighestContiguousSequence">Maior sequência contínua confirmada.</param>
/// <param name="ProcessingStatus">Status do processamento.</param>
/// <param name="RequestId">UUID da requisição.</param>
public sealed record BatchSubmissionResponse(
    string Status,
    Guid BatchId,
    long Sequence,
    DateTimeOffset PersistedAt,
    long HighestContiguousSequence,
    string ProcessingStatus,
    Guid RequestId);
