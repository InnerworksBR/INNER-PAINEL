namespace Inner.Monitoring.Edge.Collector;

/// <summary>
///     Opções de configuração do collector.
/// </summary>
public sealed class CollectorOptions
{
    public int CycleIntervalSeconds { get; set; } = 60;
    public int SnmpTimeoutMs { get; set; } = 3000;
    public int SnmpRetries { get; set; } = 3;
    public int MaxConcurrentProbes { get; set; } = 64;
    public int MaxConcurrentPolling { get; set; } = 16;
    public int MaxRequestsPerSecond { get; set; } = 200;
}
