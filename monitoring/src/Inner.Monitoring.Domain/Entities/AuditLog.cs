namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Log de auditoria para compliance.
/// </summary>
public sealed class AuditLog
{
    public Guid Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid? UserId { get; private set; }
    public Guid? SourceId { get; private set; }
    public string Action { get; private set; } = string.Empty; // create, update, delete, login, logout, etc
    public string EntityType { get; private set; } = string.Empty; // Asset, Source, Site, etc
    public Guid? EntityId { get; private set; }
    public string? OldValues { get; private set; }
    public string? NewValues { get; private set; }
    public string? IpAddress { get; private set; }
    public string? UserAgent { get; private set; }
    public string? CorrelationId { get; private set; }
    public string? SessionId { get; private set; }
    public DateTimeOffset Timestamp { get; private set; }
    public DateTimeOffset PartitionDate { get; private set; }

    private AuditLog() { }

    public static AuditLog Create(
        Guid companyId,
        string action,
        string entityType,
        Guid? userId = null,
        Guid? sourceId = null,
        Guid? entityId = null,
        string? oldValues = null,
        string? newValues = null,
        string? ipAddress = null,
        string? userAgent = null,
        string? correlationId = null,
        string? sessionId = null)
    {
        var now = DateTimeOffset.UtcNow;
        return new AuditLog
        {
            Id = Guid.NewGuid(),
            CompanyId = companyId,
            UserId = userId,
            SourceId = sourceId,
            Action = action,
            EntityType = entityType,
            EntityId = entityId,
            OldValues = oldValues,
            NewValues = newValues,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            CorrelationId = correlationId,
            SessionId = sessionId,
            Timestamp = now,
            PartitionDate = now.Date
        };
    }
}
