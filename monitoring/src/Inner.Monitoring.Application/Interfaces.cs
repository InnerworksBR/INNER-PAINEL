using Inner.Monitoring.Contracts.Enums;
using Inner.Monitoring.Contracts.Records;

namespace Inner.Monitoring.Application;

/// <summary>
///     Interface para contexto de banco de dados.
/// </summary>
public interface IDbContext
{
    // Interface marker para evitar dependência direta
}

/// <summary>
///     Interface para acesso a métricas.
/// </summary>
public interface IMetricAccess
{
    // Interface marker para acesso a métricas
}

/// <summary>
///     Interface para acesso a eventos.
/// </summary>
public interface IEventAccess
{
    // Interface marker para acesso a eventos
}

/// <summary>
///     Contexto de coleta contendo informações sobre o ambiente e fonte.
/// </summary>
public sealed class CollectionContext
{
    public required Guid SourceId { get; init; }
    public required string SourceVersion { get; init; }
    public required string Hostname { get; init; }
    public required DateTimeOffset CollectedAt { get; init; }
    public required string LocalAssetId { get; init; }
    public required string MachineFingerprint { get; init; }
    public CancellationToken CancellationToken { get; init; }
}

/// <summary>
///     Resultado de uma coleta.
/// </summary>
public sealed class CollectionResult
{
    public required IReadOnlyList<BatchRecord> Records { get; init; }
    public bool Success { get; init; } = true;
    public string? ErrorCode { get; init; }
    public string? ErrorMessage { get; init; }
}

/// <summary>
///     Interface para coletores de métricas.
/// </summary>
public interface IObservationCollector
{
    string Name { get; }
    int Priority { get; }
    Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct);
}
