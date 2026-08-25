namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Amostra de métrica.
/// </summary>
public sealed class MetricSample
{
    public DateTimeOffset CollectedAt { get; private set; }
    public long Id { get; private set; }
    public Guid CompanyId { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid AssetId { get; private set; }
    public Guid SourceId { get; private set; }
    public int MetricId { get; private set; }
    public byte[] DimensionHash { get; private set; } = Array.Empty<byte>();
    public string Dimensions { get; private set; } = "{}";
    public double? ValueDouble { get; private set; }
    public long? ValueLong { get; private set; }
    public bool? ValueBoolean { get; private set; }
    public string? ValueString { get; private set; }
    public string Quality { get; private set; } = "good";
    public DateTimeOffset ReceivedAt { get; private set; }
    public Guid BatchId { get; private set; }
    public Guid RecordId { get; private set; }

    private MetricSample() { }

    public static MetricSample Create(
        DateTimeOffset collectedAt,
        Guid companyId,
        Guid siteId,
        Guid assetId,
        Guid sourceId,
        int metricId,
        byte[] dimensionHash,
        string dimensions,
        DateTimeOffset receivedAt,
        Guid batchId,
        Guid recordId,
        double? valueDouble = null,
        long? valueLong = null,
        bool? valueBoolean = null,
        string? valueString = null,
        string quality = "good")
    {
        return new MetricSample
        {
            CollectedAt = collectedAt,
            CompanyId = companyId,
            SiteId = siteId,
            AssetId = assetId,
            SourceId = sourceId,
            MetricId = metricId,
            DimensionHash = dimensionHash,
            Dimensions = dimensions,
            ValueDouble = valueDouble,
            ValueLong = valueLong,
            ValueBoolean = valueBoolean,
            ValueString = valueString,
            Quality = quality,
            ReceivedAt = receivedAt,
            BatchId = batchId,
            RecordId = recordId
        };
    }
}
