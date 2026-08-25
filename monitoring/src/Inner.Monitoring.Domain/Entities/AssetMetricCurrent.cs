namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Valor atual de uma métrica.
/// </summary>
public sealed class AssetMetricCurrent
{
    public Guid AssetId { get; private set; }
    public int MetricId { get; private set; }
    public byte[] DimensionHash { get; private set; } = Array.Empty<byte>();
    public string Dimensions { get; private set; } = "{}";
    public DateTimeOffset CollectedAt { get; private set; }
    public DateTimeOffset ReceivedAt { get; private set; }
    public double? ValueDouble { get; private set; }
    public long? ValueLong { get; private set; }
    public bool? ValueBoolean { get; private set; }
    public string? ValueString { get; private set; }
    public string Quality { get; private set; } = "good";
    public Guid SourceId { get; private set; }
    public Guid BatchId { get; private set; }

    private AssetMetricCurrent() { }

    public static AssetMetricCurrent Create(
        Guid assetId,
        int metricId,
        byte[] dimensionHash,
        string dimensions,
        DateTimeOffset collectedAt,
        DateTimeOffset receivedAt,
        Guid sourceId,
        Guid batchId,
        double? valueDouble = null,
        long? valueLong = null,
        bool? valueBoolean = null,
        string? valueString = null,
        string quality = "good")
    {
        return new AssetMetricCurrent
        {
            AssetId = assetId,
            MetricId = metricId,
            DimensionHash = dimensionHash,
            Dimensions = dimensions,
            CollectedAt = collectedAt,
            ReceivedAt = receivedAt,
            ValueDouble = valueDouble,
            ValueLong = valueLong,
            ValueBoolean = valueBoolean,
            ValueString = valueString,
            Quality = quality,
            SourceId = sourceId,
            BatchId = batchId
        };
    }
}
