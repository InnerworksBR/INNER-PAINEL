using System.Net;
using Inner.Network.Agent.Security;

namespace Inner.Network.Agent.Transport;

public static class NetworkConfigurationValidator
{
    public static void Validate(NetworkAgentConfiguration config)
    {
        if (config.Version < 0 || config.Networks.Count > 256 || config.Credentials.Count > 1024)
            throw new InvalidOperationException("Server returned configuration outside collector limits.");
        if (config.CollectionIntervalSeconds is < 30 or > 3600 || config.DiscoveryIntervalSeconds is < 60 or > 86_400)
            throw new InvalidOperationException("Server returned invalid collection intervals.");
        if (config.Networks.Select(n => n.Id).Distinct(StringComparer.Ordinal).Count() != config.Networks.Count ||
            config.Credentials.Select(c => c.Id).Distinct(StringComparer.Ordinal).Count() != config.Credentials.Count)
            throw new InvalidOperationException("Server returned duplicate network or credential IDs.");
        if (config.Networks.Any(n => !Guid.TryParseExact(n.Id, "D", out _)) ||
            config.Credentials.Any(c => !Guid.TryParseExact(c.Id, "D", out _)))
            throw new InvalidOperationException("Server returned a network or credential ID that is not a UUID.");

        var totalAddresses = 0L;
        var ranges = new List<(uint Start, uint End)>();
        foreach (var network in config.Networks)
        {
            var (start, prefix) = ParseCidr(network.Cidr);
            var size = 1L << (32 - prefix);
            var first = (uint)(start / size * size);
            var end = (uint)(first + size - 1);
            totalAddresses += size;
            if (totalAddresses > 4096) throw new InvalidOperationException("Server configuration exceeds the 4096-address collection budget.");
            if (network.SnmpPort is < 1 or > 65535) throw new InvalidOperationException("Server returned an invalid SNMP port.");
            if (ranges.Any(range => first <= range.End && end >= range.Start)) throw new InvalidOperationException("Server returned overlapping network ranges.");
            ranges.Add((first, end));
            if (network.ExcludedIps.Distinct(StringComparer.OrdinalIgnoreCase).Count() != network.ExcludedIps.Count ||
                network.ExcludedIps.Any(ip => !TryIpv4(ip, out var value) || value < first || value > end))
                throw new InvalidOperationException("Server returned an invalid or out-of-range excluded IP.");
            if (network.CredentialIds.Count > 4 || network.CredentialIds.Distinct(StringComparer.Ordinal).Count() != network.CredentialIds.Count ||
                network.CredentialIds.Any(id => config.Credentials.All(credential => credential.Id != id)))
                throw new InvalidOperationException("Server returned an invalid credential reference.");
            if (network.NetworkScopeId is not null && !Guid.TryParseExact(network.NetworkScopeId, "D", out _))
                throw new InvalidOperationException("Server returned an invalid network scope ID.");
        }

        foreach (var credential in config.Credentials)
        {
            if (string.IsNullOrWhiteSpace(credential.Name) ||
                credential.Version is not ("2c" or "3"))
                throw new InvalidOperationException("Server returned an invalid SNMP credential.");
            if (credential.Version == "2c" && string.IsNullOrWhiteSpace(credential.Community))
                throw new InvalidOperationException("SNMP v2c credential is missing its community.");
            if (credential.Version == "3" && (string.IsNullOrWhiteSpace(credential.Username) ||
                credential.SecurityLevel is not ("authNoPriv" or "authPriv") ||
                credential.AuthProtocol is not ("SHA1" or "SHA256") || string.IsNullOrWhiteSpace(credential.AuthPassword)))
                throw new InvalidOperationException("Server returned an incomplete SNMP v3 credential.");
            if (credential.Version == "3" && credential.SecurityLevel == "authPriv" &&
                (credential.PrivacyProtocol != "AES128" || string.IsNullOrWhiteSpace(credential.PrivacyPassword)))
                throw new InvalidOperationException("Server returned an incomplete SNMP v3 privacy credential.");
        }
    }

    private static (uint Address, int Prefix) ParseCidr(string cidr)
    {
        var parts = cidr.Split('/');
        if (parts.Length != 2 || !TryIpv4(parts[0], out var address) || !int.TryParse(parts[1], out var prefix) || prefix is < 0 or > 32)
            throw new InvalidOperationException("Server returned an invalid IPv4 CIDR.");
        return (address, prefix);
    }

    private static bool TryIpv4(string value, out uint address)
    {
        address = 0;
        var octets = value.Split('.');
        if (octets.Length != 4) return false;
        foreach (var octet in octets)
        {
            if (octet.Length is < 1 or > 3 || octet.Length > 1 && octet[0] == '0' ||
                !byte.TryParse(octet, System.Globalization.NumberStyles.None, System.Globalization.CultureInfo.InvariantCulture, out var parsed)) return false;
            address = (address << 8) | parsed;
        }
        return true;
    }
}

public sealed class NetworkConfigurationCache(INetworkSecretStore secrets)
{
    public void Replace(NetworkAgentConfiguration config)
    {
        NetworkConfigurationValidator.Validate(config);
        secrets.Save("configuration_cache", System.Text.Json.JsonSerializer.Serialize(config));
    }
}
