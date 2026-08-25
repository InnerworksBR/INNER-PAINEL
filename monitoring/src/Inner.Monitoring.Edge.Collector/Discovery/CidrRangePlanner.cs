using System.Net;
using Microsoft.Extensions.Logging;

namespace Inner.Monitoring.Edge.Collector.Discovery;

/// <summary>
///     Implementação de planner de ranges CIDR IPv4.
///     Suporta enumeração streaming sem materializar todos os IPs.
/// </summary>
public sealed class CidrRangePlanner : IRangePlanner
{
    private readonly ILogger<CidrRangePlanner> _logger;

    public CidrRangePlanner(ILogger<CidrRangePlanner> logger)
    {
        _logger = logger;
    }

    public IEnumerable<IPAddress> EnumerateCandidates(
        CidrRange range,
        IEnumerable<CidrRange>? exclusions = null)
    {
        if (!range.IsValid)
        {
            _logger.LogWarning("Invalid CIDR range: {Range}", range);
            yield break;
        }

        // Build exclusion set for fast lookup
        var exclusionSet = BuildExclusionSet(exclusions?.ToList() ?? []);

        // Get first and last usable IPs
        var firstUsable = range.FirstUsable;
        var lastUsable = range.LastUsable;

        // Convert to uint32 for iteration
        var first = IpToUint32(firstUsable);
        var last = IpToUint32(lastUsable);

        _logger.LogDebug(
            "Enumerating {Count} usable IPs in range {Range}",
            range.TotalAddresses - 2,
            range);

        // Stream IPs from first usable to last usable
        for (var current = first; current <= last; current++)
        {
            var ip = Uint32ToIp(current);

            // Skip excluded IPs
            if (IsExcluded(ip, exclusionSet))
                continue;

            yield return ip;
        }
    }

    private HashSet<(uint Network, uint Mask)> BuildExclusionSet(List<CidrRange> exclusions)
    {
        var set = new HashSet<(uint Network, uint Mask)>();

        foreach (var range in exclusions)
        {
            if (!range.Contains(range.Network))
                continue;

            var network = IpToUint32(range.Network);
            var mask = range.PrefixLength == 0 ? 0 : ~((1U << (32 - range.PrefixLength)) - 1);
            set.Add((network, mask));
        }

        return set;
    }

    private bool IsExcluded(IPAddress ip, HashSet<(uint Network, uint Mask)> exclusions)
    {
        var addr = IpToUint32(ip);

        foreach (var (network, mask) in exclusions)
        {
            if ((addr & mask) == network)
                return true;
        }

        return false;
    }

    /// <summary>
    ///     Enumera todos os IPs incluindo network e broadcast (para debugging).
    /// </summary>
    public IEnumerable<IPAddress> EnumerateAll(CidrRange range)
    {
        if (!range.IsValid)
            yield break;

        var network = IpToUint32(range.Network);
        var count = (int)range.TotalAddresses;

        for (var i = 0; i < count; i++)
        {
            yield return Uint32ToIp(network + (uint)i);
        }
    }

    /// <summary>
    ///     Divide um range grande em ranges menores para paralelização.
    /// </summary>
    public IEnumerable<CidrRange> SplitIntoSubranges(CidrRange range, int maxPrefixLength = 24)
    {
        if (!range.IsValid)
            yield break;

        if (range.PrefixLength >= maxPrefixLength)
        {
            yield return range;
            yield break;
        }

        var splitPrefix = maxPrefixLength;
        var current = IpToUint32(range.Network);

        while (current < IpToUint32(range.Broadcast))
        {
            // Calculate how many /maxPrefixLength subnets we can fit
            var subnetSize = 1U << (32 - splitPrefix);
            var nextSubnet = (current / subnetSize + 1) * subnetSize;

            // Ensure we don't exceed the range
            if (nextSubnet > IpToUint32(range.Broadcast) + 1)
            {
                nextSubnet = IpToUint32(range.Broadcast) + 1;
            }

            var count = nextSubnet - current;
            var bitsLeft = 32 - splitPrefix;

            // If count is 1, we've reached the limit
            if (count == 1)
            {
                yield return new CidrRange(Uint32ToIp(current), 32);
                current++;
                continue;
            }

            // Find the appropriate prefix for this chunk
            var usedBits = 0;
            while (count > 0 && usedBits < 32)
            {
                var chunkSize = 1U << usedBits;
                if (count >= chunkSize && (current % chunkSize) == 0)
                {
                    yield return new CidrRange(Uint32ToIp(current), 32 - usedBits);
                    current += chunkSize;
                    count -= chunkSize;
                    usedBits = 0;
                }
                else
                {
                    usedBits++;
                }
            }
        }
    }

    private static uint IpToUint32(IPAddress ip)
    {
        var bytes = ip.GetAddressBytes();
        return BitConverter.ToUInt32(bytes.Reverse().ToArray(), 0);
    }

    private static IPAddress Uint32ToIp(uint addr)
    {
        return new IPAddress(BitConverter.GetBytes(addr).Reverse().ToArray());
    }
}
