using Inner.Monitoring.Edge.Collector.Discovery;

namespace Inner.Monitoring.Edge.Collector.Classification;

/// <summary>
///     Resultado de classificação de dispositivo.
/// </summary>
public sealed class ClassificationResult
{
    public required string DeviceType { get; init; }
    public required ClassificationConfidence Confidence { get; init; }
    public string? Manufacturer { get; init; }
    public string? Model { get; init; }
    public IReadOnlyList<string> MatchingPatterns { get; init; } = [];
    public Dictionary<string, string> Properties { get; init; } = [];
}

/// <summary>
///     Nível de confiança da classificação.
/// </summary>
public enum ClassificationConfidence
{
    /// <summary>Baixa confiança - dispositivo não identificado claramente</summary>
    Low,

    /// <summary>Confiança média - identificado por um único indicador</summary>
    Medium,

    /// <summary>Alta confiança - identificado por múltiplos indicadores</summary>
    High
}

/// <summary>
///     Interface para classificador de dispositivos de rede.
/// </summary>
public interface IDeviceClassifier
{
    /// <summary>
    ///     Classifica um dispositivo com base no resultado do identity probe.
    /// </summary>
    ClassificationResult Classify(IdentityProbeResult probe);
}

/// <summary>
///     Implementação de classificador de dispositivos de rede.
///     Usa sysObjectID prefix e sysDescr patterns.
/// </summary>
public sealed class NetworkDeviceClassifier : IDeviceClassifier
{
    // sysObjectID prefixes para fabricantes comuns
    private static readonly Dictionary<string, (string Manufacturer, string Type)> OidPrefixes = new()
    {
        // Cisco
        { "1.3.6.1.4.1.9.1.1", ("Cisco", "switch") },
        { "1.3.6.1.4.1.9.1.2", ("Cisco", "router") },
        { "1.3.6.1.4.1.9.1.3", ("Cisco", "switch") },
        { "1.3.6.1.4.1.11.2.3.7.1", ("HP", "switch") },
        { "1.3.6.1.4.1.11.2.3.7.2", ("HP", "switch") },
        { "1.3.6.1.4.1.14823.1", ("Aruba", "switch") },
        { "1.3.6.1.4.1.14823.2", ("Aruba", "access_point") },
        { "1.3.6.1.4.1.2636.1.1.1", ("Juniper", "router") },
        { "1.3.6.1.4.1.2636.1.1.2", ("Juniper", "switch") },
        { "1.3.6.1.4.1.6027.1.1", ("Dell", "switch") },
        { "1.3.6.1.4.1.6027.1.2", ("Dell", "switch") },
        { "1.3.6.1.4.1.2011.1.1", ("Huawei", "router") },
        { "1.3.6.1.4.1.2011.2.1", ("Huawei", "switch") },
        { "1.3.6.1.4.1.41112.1.1", ("Ubiquiti", "switch") },
        { "1.3.6.1.4.1.41112.1.2", ("Ubiquiti", "access_point") },
        { "1.3.6.1.4.1.14988.1", ("MikroTik", "router") },
        { "1.3.6.1.4.1.14988.2", ("MikroTik", "switch") },
        { "1.3.6.1.4.1.12356.1", ("Fortinet", "firewall") },
        { "1.3.6.1.4.1.25461.1", ("Palo Alto", "firewall") },
        { "1.3.6.1.4.1.2620.1.1", ("Check Point", "firewall") },
        { "1.3.6.1.4.1.318.1.1.1", ("APC", "ups") },
        { "1.3.6.1.4.1.534.1", ("Eaton", "ups") },
        // SNMPv2-MIB (generic devices)
        { "1.3.6.1.2.1.1", ("Generic", "network_device") },
    };

    // Patterns para sysDescr
    private static readonly (string Pattern, string Manufacturer, string Type)[] SysDescrPatterns =
    [
        // Switches
        ("catalyst", "Cisco", "switch"),
        ("nexus", "Cisco", "switch"),
        ("meraki", "Cisco", "switch"),
        ("ios", "Cisco", "network_device"),
        ("procurve", "HP", "switch"),
        ("aruba", "Aruba", "switch"),
        ("arubaos", "Aruba", "switch"),
        ("dell networking", "Dell", "switch"),
        ("powerconnect", "Dell", "switch"),
        ("nseries", "Dell", "switch"),
        ("ex", "Juniper", "switch"),
        ("qfx", "Juniper", "switch"),
        // Routers
        ("isr", "Cisco", "router"),
        ("asr", "Cisco", "router"),
        ("c800", "Cisco", "router"),
        ("mikrotik", "MikroTik", "router"),
        ("routeros", "MikroTik", "router"),
        ("junos", "Juniper", "router"),
        ("mx", "Juniper", "router"),
        ("ne", "Huawei", "router"),
        ("ar", "Huawei", "router"),
        ("zywall", "Zyxel", "router"),
        // Access Points
        ("aironet", "Cisco", "access_point"),
        ("aircap", "Cisco", "access_point"),
        ("unifi", "Ubiquiti", "access_point"),
        ("uap", "Ubiquiti", "access_point"),
        ("instant", "Aruba", "access_point"),
        // Firewalls
        ("fortigate", "Fortinet", "firewall"),
        ("fortios", "Fortinet", "firewall"),
        ("panos", "Palo Alto", "firewall"),
        ("vsys", "Palo Alto", "firewall"),
        ("gaia", "Check Point", "firewall"),
        // UPS
        ("eaton", "Eaton", "ups"),
        ("powerware", "Eaton", "ups"),
        ("nut", "Generic", "ups"),
        ("apc", "APC", "ups"),
        ("smart-ups", "APC", "ups"),
        ("back-ups", "APC", "ups"),
        // Printers
        ("laserjet", "HP", "printer"),
        ("designjet", "HP", "printer"),
        ("imagerunner", "Canon", "printer"),
        ("workcentre", "Xerox", "printer"),
        ("lexmark", "Lexmark", "printer"),
        ("zebra", "Zebra", "printer"),
        // Generic
        ("snmp", "Generic", "network_device"),
        ("network", "Generic", "network_device"),
        ("management", "Generic", "network_device"),
    ];

    public ClassificationResult Classify(IdentityProbeResult probe)
    {
        var matchedPatterns = new List<string>();
        var confidence = ClassificationConfidence.Low;
        string? deviceType = null;
        string? manufacturer = null;

        // First, try to match by sysObjectID
        if (!string.IsNullOrEmpty(probe.SysObjectId))
        {
            var (mfr, type) = MatchBySysObjectId(probe.SysObjectId);
            if (mfr != null && type != null)
            {
                manufacturer = mfr;
                deviceType = type;
                confidence = ClassificationConfidence.High;
                matchedPatterns.Add($"sysObjectID:{probe.SysObjectId}");
            }
        }

        // Then, try to match by sysDescr
        if (!string.IsNullOrEmpty(probe.SysDescr))
        {
            var descrMatches = MatchBySysDescr(probe.SysDescr);
            foreach (var match in descrMatches)
            {
                matchedPatterns.Add($"sysDescr:{match.Pattern}");

                // If we already have a match, increase confidence
                if (deviceType != null && match.Type == deviceType)
                {
                    confidence = confidence == ClassificationConfidence.High
                        ? ClassificationConfidence.High
                        : ClassificationConfidence.Medium;
                }
                else if (deviceType == null)
                {
                    manufacturer = match.Manufacturer;
                    deviceType = match.Type;
                    confidence = ClassificationConfidence.Medium;
                }
            }
        }

        // Use sysServices as additional hint
        if (deviceType == null && probe.SysServices.HasValue)
        {
            var servicesHint = ClassifyBySysServices(probe.SysServices.Value);
            if (servicesHint != null)
            {
                deviceType = servicesHint;
                confidence = ClassificationConfidence.Low;
                matchedPatterns.Add($"sysServices:{probe.SysServices}");
            }
        }

        // Default to unknown_device if no classification
        if (deviceType == null)
        {
            deviceType = "unknown_device";
        }

        return new ClassificationResult
        {
            DeviceType = deviceType,
            Confidence = confidence,
            Manufacturer = manufacturer,
            MatchingPatterns = matchedPatterns,
            Properties = new Dictionary<string, string>
            {
                ["sysDescr"] = probe.SysDescr ?? string.Empty,
                ["sysObjectId"] = probe.SysObjectId ?? string.Empty,
                ["sysName"] = probe.SysName ?? string.Empty,
                ["sysLocation"] = probe.SysLocation ?? string.Empty
            }
        };
    }

    private static (string? Manufacturer, string? Type) MatchBySysObjectId(string sysObjectId)
    {
        // Exact match
        if (OidPrefixes.TryGetValue(sysObjectId, out var exactMatch))
        {
            return (exactMatch.Manufacturer, exactMatch.Type);
        }

        // Prefix match - find longest matching prefix
        var bestMatch = (Manufacturer: (string?)null, Type: (string?)null);
        var bestPrefixLength = 0;

        foreach (var (prefix, (mfr, type)) in OidPrefixes)
        {
            if (sysObjectId.StartsWith(prefix + ".") ||
                sysObjectId.StartsWith(prefix))
            {
                if (prefix.Length > bestPrefixLength)
                {
                    bestPrefixLength = prefix.Length;
                    bestMatch = (mfr, type);
                }
            }
        }

        return bestMatch;
    }

    private static IEnumerable<(string Pattern, string Manufacturer, string Type)> MatchBySysDescr(string sysDescr)
    {
        var upper = sysDescr.ToUpperInvariant();
        var results = new List<(string Pattern, string Manufacturer, string Type)>();

        foreach (var (pattern, mfr, type) in SysDescrPatterns)
        {
            if (upper.Contains(pattern.ToUpperInvariant()))
            {
                results.Add((pattern, mfr, type));
            }
        }

        return results;
    }

    private static string? ClassifyBySysServices(int sysServices)
    {
        // sysServices bit flags:
        // bit 0 (1): physical
        // bit 1 (2): datalink/subnetwork
        // bit 2 (4): internet
        // bit 3 (8): end-to-end

        // A switch typically has physical + datalink
        if ((sysServices & 0x03) == 0x03 && (sysServices & 0x0C) == 0x00)
            return "switch";

        // A router typically has datalink + internet
        if ((sysServices & 0x02) != 0 && (sysServices & 0x04) != 0)
            return "router";

        return null;
    }
}
