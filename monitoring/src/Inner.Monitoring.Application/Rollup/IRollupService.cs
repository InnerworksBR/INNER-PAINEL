namespace Inner.Monitoring.Application.Rollup;

/// <summary>
///     Interface para serviço de agregação de métricas.
/// </summary>
public interface IRollupService
{
    /// <summary>
    ///     Constrói agregações de 5 minutos para um período.
    /// </summary>
    Task Build5MinuteRollupsAsync(DateTime bucketStart, CancellationToken ct);

    /// <summary>
    ///     Constrói agregações horárias para um período.
    /// </summary>
    Task BuildHourlyRollupsAsync(DateTime bucketStart, CancellationToken ct);

    /// <summary>
    ///     Executa todos os rollups pendentes até o momento atual.
    /// </summary>
    Task RunPendingRollupsAsync(CancellationToken ct);
}

/// <summary>
///     Estatísticas de uma operação de rollup.
/// </summary>
public sealed class RollupStatistics
{
    public required DateTime BucketStart { get; init; }
    public required DateTime BucketEnd { get; init; }
    public required int MetricsProcessed { get; init; }
    public required int RecordsAggregated { get; init; }
    public required TimeSpan Duration { get; init; }
    public DateTime CompletedAt { get; init; }
    public IReadOnlyList<string>? Errors { get; init; }
}

/// <summary>
///     Resultado de uma agregação.
/// </summary>
public sealed class RollupAggregation
{
    public required int MetricId { get; init; }
    public required Guid AssetId { get; init; }
    public required byte[] DimensionHash { get; init; }
    public required string Dimensions { get; init; }
    public required Guid CompanyId { get; init; }
    public required Guid? SourceId { get; init; }
    public DateTime WindowStart { get; init; }
    public DateTime WindowEnd { get; init; }

    // Agregações numéricas
    public double? Min { get; init; }
    public double? Max { get; init; }
    public double? Avg { get; init; }
    public double? Sum { get; init; }
    public int Count { get; init; }
    public double? Last { get; init; }
    public double? Rate { get; init; }
    public string? TextValue { get; init; }
    public string Quality { get; init; } = "good";
    public int SampleCount { get; init; }
    public DateTime ComputedAt { get; init; }
}

/// <summary>
///     Tipo de agregação disponível.
/// </summary>
public enum AggregationType
{
    Min,
    Max,
    Avg,
    Sum,
    Count,
    Last,
    First,
    Rate
}
