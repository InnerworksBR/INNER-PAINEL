namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Configuração versionada para uma source.
/// </summary>
public sealed class SourceConfiguration
{
    public Guid Id { get; private set; }
    public Guid SourceId { get; private set; }
    public long Version { get; private set; }
    public string Config { get; private set; } = "{}";
    public byte[] ConfigHash { get; private set; } = Array.Empty<byte>();
    public string Status { get; private set; } = "draft"; // draft, active, superseded, rejected
    public Guid? CreatedBy { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? ActivatedAt { get; private set; }

    private SourceConfiguration() { }

    public static SourceConfiguration Create(
        Guid sourceId,
        long version,
        string config,
        byte[] configHash,
        Guid? createdBy)
    {
        return new SourceConfiguration
        {
            Id = Guid.NewGuid(),
            SourceId = sourceId,
            Version = version,
            Config = config,
            ConfigHash = configHash,
            Status = "draft",
            CreatedBy = createdBy,
            CreatedAt = DateTimeOffset.UtcNow
        };
    }

    public void Activate()
    {
        Status = "active";
        ActivatedAt = DateTimeOffset.UtcNow;
    }

    public void Supersede()
    {
        Status = "superseded";
    }
}
