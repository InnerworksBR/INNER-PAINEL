using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Job de processamento de batch.
/// </summary>
public sealed class ProcessingJob
{
    public Guid Id { get; private set; }
    public Guid BatchRowId { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SourceId { get; private set; }
    public JobStatus Status { get; private set; } = JobStatus.Pending;
    public int Priority { get; private set; } = 100;
    public DateTimeOffset AvailableAt { get; private set; }
    public string? LeasedBy { get; private set; }
    public DateTimeOffset? LeaseExpiresAt { get; private set; }
    public int Attempts { get; private set; }
    public int MaxAttempts { get; private set; } = 10;
    public string? LastErrorCode { get; private set; }
    public string? LastErrorDetail { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }

    private ProcessingJob() { }

    public static ProcessingJob Create(
        Guid batchRowId,
        Guid companyId,
        Guid sourceId,
        int priority = 100)
    {
        var now = DateTimeOffset.UtcNow;
        return new ProcessingJob
        {
            Id = Guid.NewGuid(),
            BatchRowId = batchRowId,
            CompanyId = companyId,
            SourceId = sourceId,
            Status = JobStatus.Pending,
            Priority = priority,
            AvailableAt = now,
            Attempts = 0,
            MaxAttempts = 10,
            CreatedAt = now
        };
    }

    public bool TryAcquire(string workerId, TimeSpan leaseDuration)
    {
        if (Status != JobStatus.Pending && Status != JobStatus.Retrying)
            return false;

        if (LeaseExpiresAt.HasValue && LeaseExpiresAt > DateTimeOffset.UtcNow)
            return false;

        LeasedBy = workerId;
        LeaseExpiresAt = DateTimeOffset.UtcNow.Add(leaseDuration);
        Status = JobStatus.Leased;
        return true;
    }

    public void MarkCompleted()
    {
        Status = JobStatus.Completed;
        CompletedAt = DateTimeOffset.UtcNow;
        LeaseExpiresAt = null;
    }

    public void MarkRetrying(string errorCode, string? errorDetail = null)
    {
        Status = JobStatus.Retrying;
        Attempts++;
        LastErrorCode = errorCode;
        LastErrorDetail = errorDetail;
        LeaseExpiresAt = null;

        // Calcular próximo available com backoff
        var backoffSeconds = Math.Min(300, Math.Pow(2, Attempts));
        AvailableAt = DateTimeOffset.UtcNow.AddSeconds(backoffSeconds);
    }

    public void MarkDeadLetter(string errorCode, string? errorDetail = null)
    {
        Status = JobStatus.DeadLetter;
        LastErrorCode = errorCode;
        LastErrorDetail = errorDetail;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    ///     Recupera lease expirado quando o worker original está inativo.
    /// </summary>
    public void RecoverLease()
    {
        Status = JobStatus.Retrying;
        LeasedBy = null;
        LeaseExpiresAt = null;
        Attempts++;

        // Backoff exponencial
        var backoffSeconds = Math.Min(300, Math.Pow(2, Attempts));
        AvailableAt = DateTimeOffset.UtcNow.AddSeconds(backoffSeconds);
    }

    public bool IsLeaseExpired => LeaseExpiresAt.HasValue && LeaseExpiresAt < DateTimeOffset.UtcNow;
    public bool CanRetry => Attempts < MaxAttempts;
}
