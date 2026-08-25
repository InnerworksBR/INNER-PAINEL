namespace Inner.Monitoring.Domain.Entities;

/// <summary>
///     Definição de métrica do catálogo.
/// </summary>
public sealed class MetricDefinition
{
    public int Id { get; private set; }
    public string MetricKey { get; private set; } = string.Empty;
    public string DisplayName { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string ValueType { get; private set; } = "double"; // double, long, boolean, string
    public string Unit { get; private set; } = string.Empty;
    public string SemanticType { get; private set; } = "gauge"; // gauge, counter, state, text, inventory
    public string Aggregation { get; private set; } = "avg"; // avg, min_max_avg, sum, last, rate, none
    public string RetentionClass { get; private set; } = "standard"; // current_only, realtime, standard, inventory
    public int MaxDimensionSets { get; private set; } = 1000;
    public int IntroducedSchemaVersion { get; private set; } = 1;
    public bool Active { get; private set; } = true;
    public string Metadata { get; private set; } = "{}";

    private MetricDefinition() { }

    public static MetricDefinition Create(
        string metricKey,
        string displayName,
        string description,
        string valueType,
        string unit,
        string semanticType,
        string aggregation,
        string retentionClass,
        int introducedSchemaVersion = 1)
    {
        return new MetricDefinition
        {
            MetricKey = metricKey,
            DisplayName = displayName,
            Description = description,
            ValueType = valueType,
            Unit = unit,
            SemanticType = semanticType,
            Aggregation = aggregation,
            RetentionClass = retentionClass,
            MaxDimensionSets = 1000,
            IntroducedSchemaVersion = introducedSchemaVersion,
            Active = true,
            Metadata = "{}"
        };
    }
}
