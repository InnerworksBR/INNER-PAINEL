namespace Inner.Monitoring.Agent.Windows.Collectors;

/// <summary>
///     Registry de coletores disponíveis.
/// </summary>
public sealed class CollectorRegistry
{
    private readonly Dictionary<string, IObservationCollector> _collectors = new();

    public CollectorRegistry(IEnumerable<IObservationCollector> collectors)
    {
        foreach (var collector in collectors.OrderBy(c => c.Priority))
        {
            _collectors[collector.Name] = collector;
        }
    }

    public IReadOnlyList<IObservationCollector> GetAll() => _collectors.Values.OrderBy(c => c.Priority).ToList();

    public IObservationCollector? Get(string name) => _collectors.GetValueOrDefault(name);

    public IReadOnlyList<IObservationCollector> GetEnabled(IEnumerable<string> enabledNames)
    {
        var result = new List<IObservationCollector>();
        foreach (var name in enabledNames)
        {
            if (_collectors.TryGetValue(name, out var collector))
            {
                result.Add(collector);
            }
        }
        return result.OrderBy(c => c.Priority).ToList();
    }

    public bool IsEnabled(string name) => _collectors.ContainsKey(name);

    public IReadOnlyList<string> AvailableCollectors => _collectors.Keys.ToList();
}
