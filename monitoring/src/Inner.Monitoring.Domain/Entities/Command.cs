using System.Text.Json;
using Inner.Monitoring.Contracts.Enums;

namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Comando pendente para uma source.
/// </summary>
public sealed class Command
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SourceId { get; private set; }
    public string CommandType { get; private set; } = string.Empty;
    public string? Parameters { get; private set; }
    public string? IdempotencyKey { get; private set; }
    public CommandStatus Status { get; private set; } = CommandStatus.Pending;
    public int Priority { get; private set; } = 100;
    public DateTimeOffset AvailableAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? LeasedAt { get; private set; }
    public DateTimeOffset? LeaseExpiresAt { get; private set; }
    public string? LeaseTokenHash { get; private set; }
    public int Attempts { get; private set; }
    public int MaxAttempts { get; private set; } = 3;
    public string? RequestedBy { get; private set; }
    public DateTimeOffset RequestedAt { get; private set; }
    public DateTimeOffset? StartedAt { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public string? Result { get; private set; }
    public string? ErrorCode { get; private set; }

    private Command() { }

    public static Command Create(
        Guid companyId,
        Guid sourceId,
        string commandType,
        string? parameters = null,
        string? idempotencyKey = null,
        int priority = 100,
        DateTimeOffset? availableAt = null,
        DateTimeOffset? expiresAt = null,
        string? requestedBy = null)
    {
        var now = DateTimeOffset.UtcNow;
        return new Command
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            SourceId = sourceId,
            CommandType = commandType,
            Parameters = parameters,
            IdempotencyKey = idempotencyKey,
            Status = CommandStatus.Pending,
            Priority = priority,
            AvailableAt = availableAt ?? now,
            ExpiresAt = expiresAt ?? now.AddHours(1),
            RequestedBy = requestedBy,
            RequestedAt = now,
            Attempts = 0,
            MaxAttempts = 3
        };
    }

    public T? GetParameters<T>() where T : class
    {
        if (string.IsNullOrEmpty(Parameters))
            return null;

        return JsonSerializer.Deserialize<T>(Parameters, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        });
    }

    public bool TryAcquireLease(string leaseTokenHash, TimeSpan leaseDuration)
    {
        if (Status != CommandStatus.Pending)
            return false;

        if (LeaseExpiresAt.HasValue && LeaseExpiresAt > DateTimeOffset.UtcNow)
            return false;

        LeasedAt = DateTimeOffset.UtcNow;
        LeaseExpiresAt = DateTimeOffset.UtcNow.Add(leaseDuration);
        LeaseTokenHash = leaseTokenHash;
        Status = CommandStatus.Leased;

        return true;
    }

    public void MarkRunning()
    {
        Status = CommandStatus.Running;
        StartedAt = DateTimeOffset.UtcNow;
    }

    public void MarkSucceeded(string? result = null)
    {
        Status = CommandStatus.Succeeded;
        CompletedAt = DateTimeOffset.UtcNow;
        Result = result;
    }

    public void MarkFailed(string errorCode, string? result = null)
    {
        Status = CommandStatus.Failed;
        CompletedAt = DateTimeOffset.UtcNow;
        ErrorCode = errorCode;
        Result = result;
    }

    public void MarkExpired()
    {
        Status = CommandStatus.Expired;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public void MarkCancelled()
    {
        Status = CommandStatus.Cancelled;
        CompletedAt = DateTimeOffset.UtcNow;
    }

    public bool IsLeaseExpired => LeaseExpiresAt.HasValue && LeaseExpiresAt < DateTimeOffset.UtcNow;
    public bool CanRetry => Attempts < MaxAttempts && Status == CommandStatus.Failed;
}
