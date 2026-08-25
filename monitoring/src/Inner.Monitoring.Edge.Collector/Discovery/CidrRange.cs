namespace Inner.Monitoring.Edge.Collector.Discovery;

/// <summary>
///     Interface para planner de ranges CIDR IPv4.
/// </summary>
public interface IRangePlanner
{
    /// <summary>
    ///     Enumera candidatos IPs dentro de um range CIDR, excluindo ranges específicos.
    ///     Usa streaming para não materializar milhões de IPs em memória.
    /// </summary>
    IEnumerable<System.Net.IPAddress> EnumerateCandidates(
        CidrRange range,
        IEnumerable<CidrRange>? exclusions = null);
}

/// <summary>
///     Representa um range CIDR IPv4.
/// </summary>
public readonly struct CidrRange
{
    public System.Net.IPAddress Network { get; }
    public int PrefixLength { get; }
    public System.Net.IPAddress SubnetMask { get; }

    public CidrRange(System.Net.IPAddress network, int prefixLength)
    {
        Network = NormalizeNetwork(network, prefixLength);
        PrefixLength = prefixLength;
        SubnetMask = CalculateSubnetMask(prefixLength);
    }

    /// <summary>
    ///     Parse de string CIDR (ex: "192.168.1.0/24").
    /// </summary>
    public static CidrRange Parse(string cidr)
    {
        var parts = cidr.Split('/');
        if (parts.Length != 2)
            throw new ArgumentException($"Invalid CIDR format: {cidr}", nameof(cidr));

        if (!System.Net.IPAddress.TryParse(parts[0], out var network))
            throw new ArgumentException($"Invalid IP address: {parts[0]}", nameof(cidr));

        if (!int.TryParse(parts[1], out var prefix) || prefix < 0 || prefix > 32)
            throw new ArgumentException($"Invalid prefix length: {parts[1]}", nameof(cidr));

        return new CidrRange(network, prefix);
    }

    /// <summary>
    ///     Verifica se o range é válido.
    /// </summary>
    public bool IsValid => PrefixLength >= 0 && PrefixLength <= 32;

    /// <summary>
    ///     Número total de endereços no range (incluindo network e broadcast).
    /// </summary>
    public ulong TotalAddresses => PrefixLength == 32 ? 1 : (1UL << (32 - PrefixLength));

    /// <summary>
    ///     Primeiro endereço utilizável (exclui network).
    /// </summary>
    public System.Net.IPAddress FirstUsable
    {
        get
        {
            if (PrefixLength == 32)
                return Network;

            var bytes = Network.GetAddressBytes();
            var addr = BitConverter.ToUInt32(bytes.Reverse().ToArray(), 0);
            return new System.Net.IPAddress(BitConverter.GetBytes(addr + 1).Reverse().ToArray());
        }
    }

    /// <summary>
    ///     Último endereço utilizável (exclui broadcast).
    /// </summary>
    public System.Net.IPAddress LastUsable
    {
        get
        {
            if (PrefixLength == 32)
                return Network;

            var bytes = Network.GetAddressBytes();
            var addr = BitConverter.ToUInt32(bytes.Reverse().ToArray(), 0);
            return new System.Net.IPAddress(BitConverter.GetBytes(addr + TotalAddresses - 2).Reverse().ToArray());
        }
    }

    /// <summary>
    ///     Endereço de broadcast.
    /// </summary>
    public System.Net.IPAddress Broadcast
    {
        get
        {
            if (PrefixLength == 32)
                return Network;

            var bytes = Network.GetAddressBytes();
            var addr = BitConverter.ToUInt32(bytes.Reverse().ToArray(), 0);
            return new System.Net.IPAddress(BitConverter.GetBytes(addr + TotalAddresses - 1).Reverse().ToArray());
        }
    }

    /// <summary>
    ///     Verifica se um IP está dentro do range.
    /// </summary>
    public bool Contains(System.Net.IPAddress ip)
    {
        var networkBytes = Network.GetAddressBytes();
        var maskBytes = SubnetMask.GetAddressBytes();
        var ipBytes = ip.GetAddressBytes();

        for (var i = 0; i < 4; i++)
        {
            if ((ipBytes[i] & maskBytes[i]) != (networkBytes[i] & maskBytes[i]))
                return false;
        }

        return true;
    }

    private static System.Net.IPAddress NormalizeNetwork(System.Net.IPAddress ip, int prefixLength)
    {
        if (prefixLength == 32)
            return ip;

        var bytes = ip.GetAddressBytes();
        var addr = BitConverter.ToUInt32(bytes.Reverse().ToArray(), 0);
        var mask = prefixLength == 0 ? 0U : ~((1U << (32 - prefixLength)) - 1);
        var network = addr & mask;

        return new System.Net.IPAddress(BitConverter.GetBytes(network).Reverse().ToArray());
    }

    private static System.Net.IPAddress CalculateSubnetMask(int prefixLength)
    {
        if (prefixLength == 0)
            return new System.Net.IPAddress(new byte[] { 0, 0, 0, 0 });

        var mask = ~((1U << (32 - prefixLength)) - 1);
        return new System.Net.IPAddress(BitConverter.GetBytes(mask).Reverse().ToArray());
    }

    public override string ToString() => $"{Network}/{PrefixLength}";
}
