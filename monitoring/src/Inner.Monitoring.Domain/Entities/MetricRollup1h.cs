namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Rollup de métrica em 1 hora.
/// </summary>
public sealed class MetricRollup1h
{
    public int MetricId { get; private set; }
    public Guid AssetId { get; private set; }
    public byte[] DimensionHash { get; private set; } = Array.Empty<byte>();
    public string Dimensions { get; private set; } = "{}";
    public DateTimeOffset WindowStart { get; private set; }
    public DateTimeOffset WindowEnd { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SourceId { get; private set; }
    public double? Min { get; private set; }
    public double? Max { get; private set; }
    public double? Avg { get; private set; }
    public long? Sum { get; private set; }
    public long? Count { get; private set; }
    public double? Last { get; private set; }
    public double? Rate { get; private set; }
    public string? TextValue { get; private set; }
    public string Quality { get; private set; } = "good";
    public int SampleCount { get; private set; }
    public DateTimeOffset ComputedAt { get; private set; }
    public DateTimeOffset PartitionDate { get; private set; }

    private MetricRollup1h() { }

    public static MetricRollup1h Create(
        int metricId,
        Guid assetId,
        byte[] dimensionHash,
        string dimensions,
        DateTimeOffset windowStart,
        DateTimeOffset windowEnd,
        Guid companyId,
        Guid sourceId,
        double? min,
        double? max,
        double? avg,
        long? sum,
        long? count,
        double? last,
        double? rate,
        string? textValue,
        string quality,
        int sampleCount)
    {
        return new MetricRollup1h
        {
            MetricId = metricId,
            AssetId = assetId,
            DimensionHash = dimensionHash,
            Dimensions = dimensions,
            WindowStart = windowStart,
            WindowEnd = windowEnd,
            CompanyId = companyId,
            SourceId = sourceId,
            Min = min,
            Max = max,
            Avg = avg,
            Sum = sum,
            Count = count,
            Last = last,
            Rate = rate,
            TextValue = textValue,
            Quality = quality,
            SampleCount = sampleCount,
            ComputedAt = DateTimeOffset.UtcNow,
            PartitionDate = windowStart.Date
        };
    }
}
