namespace Inner.Network.Agent.Metrics;

public sealed class InterfaceRateCalculator
{
    public double? Calculate(ulong previousOctets, ulong currentOctets, double elapsedSeconds, bool restarted)
    {
        if (restarted || elapsedSeconds <= 0 || currentOctets < previousOctets) return null;
        return (currentOctets - previousOctets) * 8d / elapsedSeconds;
    }
}
