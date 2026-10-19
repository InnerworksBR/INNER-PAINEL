using System.Net;
using System.Net.Sockets;

namespace Inner.Network.Agent.Discovery;

public sealed class NetworkRangePlanner(int maxAddresses)
{
    private readonly int _maxAddresses = maxAddresses > 0 ? maxAddresses : throw new ArgumentOutOfRangeException(nameof(maxAddresses));

    public IReadOnlyList<IPAddress> ExpandDistinct(IEnumerable<string> cidrs)
    {
        var addresses = new HashSet<uint>();
        foreach (var cidr in cidrs)
        {
            var parts = cidr.Split('/', StringSplitOptions.TrimEntries);
            if (parts.Length != 2 || !IPAddress.TryParse(parts[0], out var address) || address.AddressFamily != AddressFamily.InterNetwork ||
                !int.TryParse(parts[1], out var prefix) || prefix is < 0 or > 32)
                throw new InvalidOperationException($"Invalid IPv4 CIDR: {cidr}");

            var ip = ToUInt32(address);
            var mask = prefix == 0 ? 0u : uint.MaxValue << (32 - prefix);
            var network = ip & mask;
            var broadcast = network | ~mask;
            var first = prefix <= 30 ? network + 1 : network;
            var last = prefix <= 30 ? broadcast - 1 : broadcast;
            for (var current = first; current <= last; current++)
            {
                var candidate = FromUInt32(current);
                if (IsExcluded(candidate)) continue;
                addresses.Add(current);
                if (addresses.Count > _maxAddresses)
                    throw new InvalidOperationException($"Configured networks exceed the {_maxAddresses} address limit.");
                if (current == uint.MaxValue) break;
            }
        }
        return addresses.Order().Select(FromUInt32).ToArray();
    }

    private static bool IsExcluded(IPAddress address)
    {
        var bytes = address.GetAddressBytes();
        return bytes[0] is 0 or 127 or >= 224 || (bytes[0] == 169 && bytes[1] == 254);
    }

    private static uint ToUInt32(IPAddress address) => BitConverter.ToUInt32(address.GetAddressBytes().Reverse().ToArray());
    private static IPAddress FromUInt32(uint address) => new(BitConverter.GetBytes(address).Reverse().ToArray());
}
