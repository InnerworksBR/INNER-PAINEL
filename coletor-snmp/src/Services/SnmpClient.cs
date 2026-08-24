using System.Net;
using System.Net.Sockets;
using System.Net.NetworkInformation;

namespace ColetorSNMP.Services;

public class SnmpClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly string _defaultCommunity;
    private readonly int _timeoutMs;
    private readonly ILogger<SnmpClient> _logger;
    private bool _disposed;

    // OIDs principais MIB-II
    private static readonly Dictionary<string, string> Oids = new()
    {
        ["sysDescr"]     = "1.3.6.1.2.1.1.1.0",
        ["sysUpTime"]    = "1.3.6.1.2.1.1.3.0",
        ["sysContact"]   = "1.3.6.1.2.1.1.4.0",
        ["sysName"]      = "1.3.6.1.2.1.1.5.0",
        ["sysLocation"]  = "1.3.6.1.2.1.1.6.0",
        ["ifNumber"]     = "1.3.6.1.2.1.2.1.0",
        ["sysServices"]  = "1.3.6.1.2.1.1.7.0"
    };

    // OIDs de interface
    private static readonly Dictionary<string, string> InterfaceOids = new()
    {
        ["ifDescr"]      = "1.3.6.1.2.1.2.2.1.2",
        ["ifType"]       = "1.3.6.1.2.1.2.2.1.3",
        ["ifMtu"]        = "1.3.6.1.2.1.2.2.1.4",
        ["ifSpeed"]      = "1.3.6.1.2.1.2.2.1.5",
        ["ifPhysAddress"]= "1.3.6.1.2.1.2.2.1.6",
        ["ifAdminStatus"]= "1.3.6.1.2.1.2.2.1.7",
        ["ifOperStatus"] = "1.3.6.1.2.1.2.2.1.8",
        ["ifInOctets"]   = "1.3.6.1.2.1.2.2.1.10",
        ["ifOutOctets"]  = "1.3.6.1.2.1.2.2.1.16"
    };

    public SnmpClient(HttpClient httpClient, string defaultCommunity, int timeoutMs, ILogger<SnmpClient> logger)
    {
        _httpClient = httpClient;
        _defaultCommunity = defaultCommunity;
        _timeoutMs = timeoutMs;
        _logger = logger;
    }

    /// <summary>
    /// Testa conectividade SNMP para um IP usando ping ICMP como proxy
    /// (Em produção, usar biblioteca SNMP real como SnmpSharpNet)
    /// </summary>
    public async Task<bool> TestSnmpReachabilityAsync(string ipAddress)
    {
        try
        {
            using var ping = new Ping();
            var reply = await ping.SendPingAsync(ipAddress, _timeoutMs);
            return reply.Status == IPStatus.Success;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Coleta dados SNMP simulados para demonstração
    /// Em produção, substituir por SnmpSharpNet.Snmp.Get/Snmp.Walk
    /// </summary>
    public async Task<Dictionary<string, string>> GetSnmpDataAsync(string ipAddress, string? community = null)
    {
        var result = new Dictionary<string, string>();
        community ??= _defaultCommunity;

        try
        {
            // Verifica se o host responde a ping (indica que está ativo)
            if (!await TestSnmpReachabilityAsync(ipAddress))
            {
                _logger.LogDebug("Host {Ip} não respondeu ao ping", ipAddress);
                return result;
            }

            // Simula dados SNMP baseados no IP
            // Em produção, usar SnmpSharpNet para coletar dados reais
            var octets = ipAddress.Split('.').Select(o => int.Parse(o)).ToArray();

            // Gera sysDescr baseado no último octeto para simular variety
            result["sysDescr"] = GenerateSimulatedSysDescr(octets[3]);
            result["sysUpTime"] = (DateTimeOffset.UtcNow.ToUnixTimeSeconds() * 100 - octets[3] * 1000).ToString();
            result["sysName"] = $"device-{ipAddress.Replace(".", "-")}";
            result["sysLocation"] = "Data Center - Rack " + ((octets[3] / 24) + 1);
            result["sysContact"] = "admin@empresa.local";
            result["ifNumber"] = Math.Max(2, (octets[3] % 4) + 2).ToString();
            result["sysServices"] = SimulateSysServices(octets[3]);

            // Simula interfaces
            var ifCount = int.Parse(result["ifNumber"]);
            for (int i = 1; i <= ifCount; i++)
            {
                result[$"ifDescr.{i}"] = $"GigabitEthernet0/{i}";
                result[$"ifType.{i}"] = (i <= 2) ? "6" : "6"; // ethernetCsmacd
                result[$"ifOperStatus.{i}"] = (octets[3] % 10 != 0) ? "1" : "2"; // up ou down
                result[$"ifAdminStatus.{i}"] = "1";
            }

            _logger.LogDebug("Coletados dados SNMP de {Ip}: {Count} OIDs", ipAddress, result.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao coletar dados SNMP de {Ip}", ipAddress);
        }

        await Task.Delay(10); // Simula latência de rede
        return result;
    }

    private string GenerateSimulatedSysDescr(int lastOctet)
    {
        var devices = new[]
        {
            "Cisco IOS Software, Version 15.2(4)M7",
            "HP ProCurve J9727A 2820-24G-PoE+, PS VRRP",
            "MikroTik RouterOS CHR 7.14.2",
            "Ubiquiti UniFi Dream Machine Pro",
            "TP-LINK JetStream 24-Port Gigabit Switch",
            "Dell Networking N3048P-ON, Version 9.14.1.0",
            "Aruba 2930F 24G PoE+ 4SFP+",
            "Juniper EX4300-48P, Version 21.4R3",
            "Zyxel GS1900-24HP, V4.70(ABZM.0)",
            "Cisco Meraki MR46 Cloud Managed AP"
        };

        return devices[lastOctet % devices.Length] +
               $"\nHardware: x86_64\nSoftware: Firmware {lastOctet}.{lastOctet % 10}.0";
    }

    private string SimulateSysServices(int lastOctet)
    {
        // Layer 3 router = 72, Layer 2 switch = 78
        return (lastOctet % 3 == 0) ? "72" : "78";
    }

    /// <summary>
    /// Envia dados do dispositivo para a API do portal
    /// </summary>
    public async Task<bool> SendDeviceToApiAsync(Models.NetworkDevice device)
    {
        try
        {
            var payload = new
            {
                ip = device.IpAddress,
                hostname = device.Hostname,
                deviceType = device.DeviceType,
                manufacturer = device.Manufacturer,
                model = device.Model,
                description = device.Description,
                serialNumber = device.SerialNumber,
                firmware = device.Firmware,
                osVersion = device.OsVersion,
                uptime = device.UptimeSeconds,
                interfaceCount = device.InterfaceCount,
                location = device.Location,
                community = device.Community,
                snmpPort = device.SnmpPort,
                snmpVersion = device.SnmpVersion,
                interfaces = device.Interfaces,
                lastSeen = device.LastSeen
            };

            var response = await _httpClient.PostAsJsonAsync("/api/snmp/devices", payload);

            if (response.IsSuccessStatusCode)
            {
                _logger.LogDebug("Device {Ip} enviado para API", device.IpAddress);
                return true;
            }

            _logger.LogWarning("API retornou {Status} para device {Ip}",
                response.StatusCode, device.IpAddress);
            return false;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar device {Ip} para API", device.IpAddress);
            return false;
        }
    }

    public void Dispose()
    {
        if (!_disposed)
        {
            _disposed = true;
        }
    }
}
