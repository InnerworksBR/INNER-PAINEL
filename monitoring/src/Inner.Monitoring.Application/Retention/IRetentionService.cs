namespace Inner.Monitoring.Application.Retention;

/// <summary>
///     Interface para serviço de retenção de dados.
/// </summary>
public interface IRetentionService
{
    /// <summary>
    ///     Aplica política de retenção, removendo dados antigos.
    /// </summary>
    Task ApplyRetentionAsync(CancellationToken ct);

    /// <summary>
    ///     Cria partições futuras para métricas.
    /// </summary>
    Task CreatePartitionsAsync(int daysAhead, CancellationToken ct);

    /// <summary>
    ///     Remove partições antigas que excederam a retenção.
    /// </summary>
    Task DropOldPartitionsAsync(CancellationToken ct);

    /// <summary>
    ///     Obtém estatísticas de retenção.
    /// </summary>
    Task<RetentionStatistics> GetStatisticsAsync(CancellationToken ct);
}

/// <summary>
///     Estatísticas de retenção.
/// </summary>
public sealed class RetentionStatistics
{
    public required DateTime ComputedAt { get; init; }
    public required RetentionClassStats RealtimeStats { get; init; }
    public required RetentionClassStats StandardStats { get; init; }
    public required RetentionClassStats Rollup5mStats { get; init; }
    public required RetentionClassStats Rollup1hStats { get; init; }
    public required RetentionClassStats EventStats { get; init; }
    public required IReadOnlyList<PartitionInfo> Partitions { get; init; }
    public required IReadOnlyList<string> Warnings { get; init; }
}

/// <summary>
///     Estatísticas de uma classe de retenção.
/// </summary>
public sealed class RetentionClassStats
{
    public required int RetentionDays { get; init; }
    public required DateTime CutoffDate { get; init; }
    public required long EstimatedRowsToDelete { get; init; }
    public required long EstimatedBytesToFree { get; init; }
    public DateTime? OldestRecordDate { get; init; }
    public DateTime? NewestRecordDate { get; init; }
}

/// <summary>
///     Informação de uma partição.
/// </summary>
public sealed class PartitionInfo
{
    public required string TableName { get; init; }
    public required string PartitionName { get; init; }
    public required DateTime RangeStart { get; init; }
    public required DateTime RangeEnd { get; init; }
    public required long RowCount { get; init; }
    public required long SizeBytes { get; init; }
    public required bool IsFuture { get; init; }
}

/// <summary>
///     Política de retenção configurável.
/// </summary>
public sealed class RetentionPolicy
{
    /// <summary>
    ///     Retenção para dados realtime ( segundos).
    /// </summary>
    public int RealtimeRetentionDays { get; init; } = 7;

    /// <summary>
    ///     Retenção para dados standard (30 dias).
    /// </summary>
    public int StandardRetentionDays { get; init; } = 30;

    /// <summary>
    ///     Retenção para rollups de 5 minutos (180 dias).
    /// </summary>
    public int Rollup5mRetentionDays { get; init; } = 180;

    /// <summary>
    ///     Retenção para rollups hourly (730 dias).
    /// </summary>
    public int Rollup1hRetentionDays { get; init; } = 730;

    /// <summary>
    ///     Retenção para eventos (730 dias).
    /// </summary>
    public int EventRetentionDays { get; init; } = 730;

    /// <summary>
    ///     Número de dias para criar partições futuras.
    /// </summary>
    public int PartitionDaysAhead { get; init; } = 7;

    /// <summary>
    ///     Tamanho do lote para deleções.
    /// </summary>
    public int DeleteBatchSize { get; init; } = 10000;
}
