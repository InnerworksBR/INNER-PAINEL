using Inner.Agent.Windows.Contracts;

namespace Inner.Agent.Windows.Collectors;

public interface IHostMetricsCollector
{
    Task<HostMetrics> CollectAsync(CancellationToken cancellationToken);
}
