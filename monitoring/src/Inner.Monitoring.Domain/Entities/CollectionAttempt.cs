namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Tentativa de coleta individual.
/// </summary>
public sealed class CollectionAttempt
{
    public Guid Id { get; private set; }
    public Guid SourceId { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? TargetAssetId { get; private set; }
    public string TargetIp { get; private set; } = string.Empty;
    public string? LocalAssetId { get; private set; }
    public Guid CredentialId { get; private set; }
    public string CollectionType { get; private set; } = string.Empty; // snmp_walk, snmp_get, wmi_query, etc
    public string? Oid { get; private set; }
    public DateTimeOffset StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public long DurationMs { get; private set; }
    public string Result { get; private set; } = string.Empty; // success, timeout, auth_error, etc
    public string? ErrorCode { get; private set; }
    public string? ErrorDetail { get; private set; }
    public int RecordsCollected { get; private set; }
    public DateTimeOffset PartitionDate { get; private set; }

    private CollectionAttempt() { }

    public static CollectionAttempt Create(
        Guid sourceId,
        Guid companyId,
        string targetIp,
        Guid credentialId,
        string collectionType,
        string? oid,
        DateTimeOffset startedAt)
    {
        return new CollectionAttempt
        {
            Id = Guid.NewGuid(),
            SourceId = sourceId,
            CompanyId = companyId,
            TargetIp = targetIp,
            CredentialId = credentialId,
            CollectionType = collectionType,
            Oid = oid,
            StartedAt = startedAt,
            Result = "pending",
            PartitionDate = startedAt.Date
        };
    }

    public void Complete(
        string result,
        long durationMs,
        int recordsCollected,
        string? errorCode = null,
        string? errorDetail = null,
        Guid? targetAssetId = null,
        string? localAssetId = null)
    {
        CompletedAt = DateTimeOffset.UtcNow;
        DurationMs = durationMs;
        Result = result;
        ErrorCode = errorCode;
        ErrorDetail = errorDetail;
        RecordsCollected = recordsCollected;
        TargetAssetId = targetAssetId;
        LocalAssetId = localAssetId;
    }

    public void Fail(string errorCode, string? errorDetail, long durationMs)
    {
        CompletedAt = DateTimeOffset.UtcNow;
        DurationMs = durationMs;
        Result = "failed";
        ErrorCode = errorCode;
        ErrorDetail = errorDetail;
    }
}
