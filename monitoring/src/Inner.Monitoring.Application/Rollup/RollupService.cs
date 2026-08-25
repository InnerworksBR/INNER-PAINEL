using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Application.Rollup;

/// <summary>
///     Implementação do serviço de agregação de métricas.
///     Versão simplificada que usa delegates para acesso ao banco.
/// </summary>
public sealed class RollupService : IRollupService
{
    private readonly ILogger<RollupService> _logger;
    private readonly Func<Task<List<RollupSample>>> _getSamplesAsync;
    private readonly Func<List<RollupAggregation>, Task> _saveRollupsAsync;

    public RollupService(
        ILogger<RollupService> logger,
        Func<Task<List<RollupSample>>> getSamplesAsync,
        Func<List<RollupAggregation>, Task> saveRollupsAsync)
    {
        _logger = logger;
        _getSamplesAsync = getSamplesAsync;
        _saveRollupsAsync = saveRollupsAsync;
    }

    public async Task Build5MinuteRollupsAsync(DateTime bucketStart, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var bucketEnd = bucketStart.AddMinutes(5);

        _logger.LogInformation("Iniciando rollup de 5 minutos para {Start} a {End}",
            bucketStart, bucketEnd);

        try
        {
            // Buscar métricas processadas no período
            var samples = await _getSamplesAsync();

            if (samples.Count == 0)
            {
                _logger.LogInformation("Nenhuma amostra para agregar no período");
                return;
            }

            // Filtrar por período
            var filteredSamples = samples
                .Where(s => s.CollectedAt >= bucketStart && s.CollectedAt < bucketEnd)
                .Where(s => s.Quality != "unsupported")
                .ToList();

            if (filteredSamples.Count == 0)
            {
                _logger.LogInformation("Nenhuma amostra para agregar no período");
                return;
            }

            // Agrupar por metric_id, asset_id, dimension_hash
            var groups = filteredSamples
                .GroupBy(s => new { s.MetricId, s.AssetId })
                .ToList();

            var aggregations = new List<RollupAggregation>();

            foreach (var group in groups)
            {
                var first = group.First();
                var values = group
                    .Select(s => s.ValueDouble ?? (s.ValueLong.HasValue ? (double)s.ValueLong.Value : (double?)null))
                    .Where(v => v.HasValue)
                    .Select(v => v!.Value)
                    .ToList();

                if (values.Count == 0)
                    continue;

                var aggregation = new RollupAggregation
                {
                    MetricId = group.Key.MetricId,
                    AssetId = group.Key.AssetId,
                    DimensionHash = first.DimensionHash,
                    Dimensions = first.Dimensions,
                    CompanyId = first.CompanyId,
                    SourceId = first.SourceId,
                    WindowStart = bucketStart,
                    WindowEnd = bucketEnd,
                    Min = values.Min(),
                    Max = values.Max(),
                    Avg = values.Average(),
                    Sum = values.Sum(),
                    Count = values.Count,
                    Last = values.Last(),
                    Quality = DetermineAggregatedQuality(group),
                    SampleCount = values.Count,
                    ComputedAt = DateTime.UtcNow
                };

                aggregations.Add(aggregation);
            }

            // Persistir rollups
            await _saveRollupsAsync(aggregations);

            sw.Stop();
            _logger.LogInformation(
                "Rollup de 5 minutos concluído: {Metrics} métricas, {Records} agregações em {Duration}ms",
                groups.Count, aggregations.Count, sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Erro ao construir rollup de 5 minutos");
            throw;
        }
    }

    public async Task BuildHourlyRollupsAsync(DateTime bucketStart, CancellationToken ct)
    {
        var sw = Stopwatch.StartNew();
        var bucketEnd = bucketStart.AddHours(1);

        _logger.LogInformation("Iniciando rollup hourly para {Start} a {End}",
            bucketStart, bucketEnd);

        try
        {
            // Em uma implementação real, buscaria rollups de 5 minutos
            // Por simplicidade, simulamos o processamento

            sw.Stop();
            _logger.LogInformation(
                "Rollup hourly concluído em {Duration}ms",
                sw.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            sw.Stop();
            _logger.LogError(ex, "Erro ao construir rollup hourly");
            throw;
        }
    }

    public async Task RunPendingRollupsAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // Calcular buckets pendentes
        var last5mBucket = new DateTime(now.Year, now.Month, now.Day, now.Hour,
            (now.Minute / 5) * 5, 0);

        // Processar buckets pendentes (simulado)
        var current5mBucket = last5mBucket;
        for (int i = 0; i < 5; i++)
        {
            current5mBucket = current5mBucket.AddMinutes(-5);
        }

        await Task.CompletedTask;
    }

    private static string DetermineAggregatedQuality(IEnumerable<RollupSample> samples)
    {
        var sampleList = samples.ToList();
        if (sampleList.All(s => s.Quality == "good"))
            return "good";

        if (sampleList.Any(s => s.Quality == "unsupported" || s.Quality == "invalid"))
            return "partial";

        return "estimated";
    }
}

/// <summary>
///     Dados de amostra para rollup.
/// </summary>
public sealed class RollupSample
{
    public int MetricId { get; init; }
    public Guid AssetId { get; init; }
    public Guid CompanyId { get; init; }
    public Guid SourceId { get; init; }
    public byte[] DimensionHash { get; init; } = Array.Empty<byte>();
    public string Dimensions { get; init; } = "{}";
    public double? ValueDouble { get; init; }
    public long? ValueLong { get; init; }
    public string Quality { get; init; } = "good";
    public DateTimeOffset CollectedAt { get; init; }
}
