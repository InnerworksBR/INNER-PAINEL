using System.Text.RegularExpressions;
using ColetorSNMP.Models;

namespace ColetorSNMP.Services;

public class DeviceParser
{
    private static readonly List<(Regex Pattern, string Type, string Manufacturer)> DevicePatterns = new()
    {
        // Switches
        (new Regex(@"Cisco.*(?:Switch|IOS)", RegexOptions.IgnoreCase), "Switch", "Cisco"),
        (new Regex(@"HP.*(?:ProCurve|switch|J-series)", RegexOptions.IgnoreCase), "Switch", "HP"),
        (new Regex(@"Aruba.*(?:switch|OS)", RegexOptions.IgnoreCase), "Switch", "Aruba"),
        (new Regex(@"Dell.*(?:N\d+|PowerConnect|switch)", RegexOptions.IgnoreCase), "Switch", "Dell"),
        (new Regex(@"Juniper.*(?:EX|EX 系列)", RegexOptions.IgnoreCase), "Switch", "Juniper"),
        (new Regex(@"TP-LINK.*(?:JetStream|TL-SG\d+)", RegexOptions.IgnoreCase), "Switch", "TP-Link"),
        (new Regex(@"Zyxel.*(?:GS\d+|switch)", RegexOptions.IgnoreCase), "Switch", "Zyxel"),
        (new Regex(@"\b(D-Link|DES-|DGS-)\b.*switch", RegexOptions.IgnoreCase), "Switch", "D-Link"),
        (new Regex(@"Cisco.*Meraki.*(?:MS|MX)", RegexOptions.IgnoreCase), "Switch", "Cisco Meraki"),

        // Routers
        (new Regex(@"MikroTik.*(?:Router|RB|CCR)", RegexOptions.IgnoreCase), "Router", "MikroTik"),
        (new Regex(@"Cisco.*(?:Router|ISR|ASR)", RegexOptions.IgnoreCase), "Router", "Cisco"),
        (new Regex(@"Ubiquiti.*(?:EdgeRouter|ER-X)", RegexOptions.IgnoreCase), "Router", "Ubiquiti"),
        (new Regex(@"TP-LINK.*(?:TL-R\d+|Archer|router)", RegexOptions.IgnoreCase), "Router", "TP-Link"),
        (new Regex(@"Juniper.*(?:SRX|J-series|vSRX)", RegexOptions.IgnoreCase), "Router", "Juniper"),

        // Access Points
        (new Regex(@"Cisco.*(?:AIR-|AP-|Aironet)", RegexOptions.IgnoreCase), "Access Point", "Cisco"),
        (new Regex(@"Cisco.*Meraki.*(?:MR|MR\d+)", RegexOptions.IgnoreCase), "Access Point", "Cisco Meraki"),
        (new Regex(@"Ubiquiti.*(?:UniFi|AP-AC|UAP)", RegexOptions.IgnoreCase), "Access Point", "Ubiquiti"),
        (new Regex(@"Aruba.*(?:AP| Instant)", RegexOptions.IgnoreCase), "Access Point", "Aruba"),
        (new Regex(@"TP-LINK.*(?:EAP|AP)", RegexOptions.IgnoreCase), "Access Point", "TP-Link"),
        (new Regex(@"HP.*(?:Aruba|AP)", RegexOptions.IgnoreCase), "Access Point", "HP Aruba"),
        (new Regex(@"Ruckus.*(?:ZoneDirector|SmartZone|AP)", RegexOptions.IgnoreCase), "Access Point", "Ruckus"),
        (new Regex(@"NETGEAR.*(?:AP|WAC\d+)", RegexOptions.IgnoreCase), "Access Point", "Netgear"),

        // Firewalls
        (new Regex(@"Fortinet.*(?:FortiGate|FW)", RegexOptions.IgnoreCase), "Firewall", "Fortinet"),
        (new Regex(@"Palo Alto.*(?:PA-|PAN-)", RegexOptions.IgnoreCase), "Firewall", "Palo Alto"),
        (new Regex(@"Cisco.*(?:ASA|Firepower|FPR)", RegexOptions.IgnoreCase), "Firewall", "Cisco"),
        (new Regex(@"Sophos.*(?:XG|SG|FW)", RegexOptions.IgnoreCase), "Firewall", "Sophos"),
        (new Regex(@"WatchGuard.*(?:Firebox|XTM)", RegexOptions.IgnoreCase), "Firewall", "WatchGuard"),

        // Impressoras
        (new Regex(@"(?:HP|LaserJet|OfficeJet|DesignJet|PageWide)", RegexOptions.IgnoreCase), "Printer", "HP"),
        (new Regex(@"Brother.*(?:MFC|DCP|HL)", RegexOptions.IgnoreCase), "Printer", "Brother"),
        (new Regex(@"Canon.*(?:imageCLASS|imageRUNNER|GPR)", RegexOptions.IgnoreCase), "Printer", "Canon"),
        (new Regex(@"Epson.*(?:WorkForce|EcoTank|L-series)", RegexOptions.IgnoreCase), "Printer", "Epson"),
        (new Regex(@"Lexmark.*(?:CS|CX|MS|MX|XM)", RegexOptions.IgnoreCase), "Printer", "Lexmark"),
        (new Regex(@"(?:Xerox|Phaser|WorkCentre|VersaLink)", RegexOptions.IgnoreCase), "Printer", "Xerox"),
        (new Regex(@"(?:Kyocera|ECOSYS|TASKalfa)", RegexOptions.IgnoreCase), "Printer", "Kyocera"),
        (new Regex(@"Ricoh.*(?:Aficio|IM|SP)", RegexOptions.IgnoreCase), "Printer", "Ricoh"),
        (new Regex(@"(?:Samsung|SCX|ML-|SL-)", RegexOptions.IgnoreCase), "Printer", "Samsung"),
        (new Regex(@"Sharp.*(?:MX|GE|AR-)", RegexOptions.IgnoreCase), "Printer", "Sharp"),
        (new Regex(@"OKI.*(?:MC\d+|B\d+|C\d+)", RegexOptions.IgnoreCase), "Printer", "OKI"),

        // Sensores / Monitoramento
        (new Regex(@"(?:temperature|humidity|sensor|ambiente)", RegexOptions.IgnoreCase), "Sensor", "Generic"),
        (new Regex(@"APC.*(?:Smart-UPS|Symmetra)", RegexOptions.IgnoreCase), "UPS", "APC"),
        (new Regex(@"Eaton.*(?:UPS|PW)", RegexOptions.IgnoreCase), "UPS", "Eaton"),
        (new Regex(@"(?:Liebert|Vertiv).*(?:UPS|CRV)", RegexOptions.IgnoreCase), "UPS", "Vertiv"),

        // Storage / NAS
        (new Regex(@"Synology.*(?:DS|RS|DDSM)", RegexOptions.IgnoreCase), "Storage", "Synology"),
        (new Regex(@"QNAP.*(?:TS|TVS|QS|HDL)", RegexOptions.IgnoreCase), "Storage", "QNAP"),
        (new Regex(@"NetApp.*(?:FAS|AFF|ONTAP)", RegexOptions.IgnoreCase), "Storage", "NetApp"),
        (new Regex(@"Dell.*(?:PowerVault|SC|EF|iSCSI)", RegexOptions.IgnoreCase), "Storage", "Dell"),
        (new Regex(@"HP.*(?:MSA|Nimble|3PAR|Storeserv)", RegexOptions.IgnoreCase), "Storage", "HP"),

        // Load Balancers
        (new Regex(@"F5.*(?:BIG-IP|LTM|GTM|BIGIP)", RegexOptions.IgnoreCase), "Load Balancer", "F5"),
        (new Regex(@"Citrix.*(?:ADC|Netscaler|VPX)", RegexOptions.IgnoreCase), "Load Balancer", "Citrix"),
        (new Regex(@"A10.*(?:Thunder|AX|ADC)", RegexOptions.IgnoreCase), "Load Balancer", "A10"),

        // Gateways / UTM
        (new Regex(@"SonicWALL.*(?:TZ|SM|NSA)", RegexOptions.IgnoreCase), "UTM", "SonicWall"),
        (new Regex(@"Ubiquiti.*(?:Dream|UDM|UDM-Pro)", RegexOptions.IgnoreCase), "Gateway", "Ubiquiti"),
        (new Regex(@"Intelbras.*(?:SG|router|firewall)", RegexOptions.IgnoreCase), "Router", "Intelbras"),
    };

    private static readonly Regex VersionRegex = new(@"Version\s+(\d+\.\d+(?:\.\d+)?)", RegexOptions.IgnoreCase);
    private static readonly Regex FirmwareRegex = new(@"Firmware\s+(\d+\.\d+(?:\.\d+)?)", RegexOptions.IgnoreCase);
    private static readonly Regex ModelRegex = new(@"(?:Model|Product)\s*[:\-]?\s*(\S+)", RegexOptions.IgnoreCase);
    private static readonly Regex SerialRegex = new(@"(?:Serial|S\/N)[:\-]?\s*([A-Z0-9\-]+)", RegexOptions.IgnoreCase);

    /// <summary>
    /// Infere tipo de dispositivo e fabricante baseado no sysDescr
    /// </summary>
    public (string Type, string Manufacturer) ParseDeviceType(string sysDescr)
    {
        if (string.IsNullOrWhiteSpace(sysDescr))
            return ("Unknown", "Unknown");

        foreach (var (pattern, type, manufacturer) in DevicePatterns)
        {
            if (pattern.IsMatch(sysDescr))
            {
                return (type, manufacturer);
            }
        }

        // Fallback: análise por palavras-chave genéricas
        var descrLower = sysDescr.ToLowerInvariant();

        if (descrLower.Contains("switch") || descrLower.Contains("ethernet"))
            return ("Switch", "Unknown");
        if (descrLower.Contains("router") || descrLower.Contains("gateway"))
            return ("Router", "Unknown");
        if (descrLower.Contains("wireless") || descrLower.Contains("wifi") || descrLower.Contains("ap "))
            return ("Access Point", "Unknown");
        if (descrLower.Contains("printer") || descrLower.Contains("mfp") || descrLower.Contains("impressora"))
            return ("Printer", "Unknown");
        if (descrLower.Contains("server") || descrLower.Contains("windows"))
            return ("Server", "Unknown");

        return ("Unknown", "Unknown");
    }

    /// <summary>
    /// Extrai informações detalhadas do sysDescr
    /// </summary>
    public void ExtractDeviceInfo(string sysDescr, NetworkDevice device)
    {
        if (string.IsNullOrWhiteSpace(sysDescr))
            return;

        // Extrai versão do OS
        var versionMatch = VersionRegex.Match(sysDescr);
        if (versionMatch.Success)
        {
            device.OsVersion = versionMatch.Groups[1].Value;
        }

        // Extrai firmware
        var firmwareMatch = FirmwareRegex.Match(sysDescr);
        if (firmwareMatch.Success)
        {
            device.Firmware = firmwareMatch.Groups[1].Value;
        }

        // Extrai modelo
        var modelMatch = ModelRegex.Match(sysDescr);
        if (modelMatch.Success)
        {
            device.Model = modelMatch.Groups[1].Value;
        }

        // Extrai serial
        var serialMatch = SerialRegex.Match(sysDescr);
        if (serialMatch.Success)
        {
            device.SerialNumber = serialMatch.Groups[1].Value;
        }

        // Tenta extrair manufacturer do sysDescr se não conseguiu
        if (string.IsNullOrEmpty(device.Manufacturer) || device.Manufacturer == "Unknown")
        {
            var (type, mfr) = ParseDeviceType(sysDescr);
            device.Manufacturer = mfr;
        }
    }

    /// <summary>
    /// Normaliza tipo de dispositivo para categorias do sistema
    /// </summary>
    public string NormalizeDeviceType(string deviceType)
    {
        var normalized = deviceType.ToLowerInvariant().Trim();

        return normalized switch
        {
            "switch" or "sw" or "switchger" => "Switch",
            "router" or "rt" or "gateway" => "Router",
            "access point" or "ap" or "wireless" or "wifi" => "Access Point",
            "firewall" or "fw" or "utm" => "Firewall",
            "printer" or "impressora" or "print" => "Printer",
            "server" or "srv" => "Server",
            "sensor" or "monitor" => "Sensor",
            "ups" or "nobreak" => "UPS",
            "storage" or "nas" or "san" => "Storage",
            "load balancer" or "lb" => "Load Balancer",
            "default" or "unknown" or _ => "Unknown"
        };
    }
}
