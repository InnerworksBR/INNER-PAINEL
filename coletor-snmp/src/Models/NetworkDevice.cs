namespace ColetorSNMP.Models;

public class NetworkDevice
{
    public int Id { get; set; }
    public string IpAddress { get; set; } = string.Empty;
    public string Hostname { get; set; } = string.Empty;
    public string DeviceType { get; set; } = "Unknown";
    public string Manufacturer { get; set; } = string.Empty;
    public string Model { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public string MacAddress { get; set; } = string.Empty;
    public string Firmware { get; set; } = string.Empty;
    public int InterfaceCount { get; set; }
    public string SerialNumber { get; set; } = string.Empty;
    public long UptimeSeconds { get; set; }
    public bool IsReachable { get; set; }
    public DateTime LastSeen { get; set; } = DateTime.UtcNow;
    public string Location { get; set; } = string.Empty;
    public string Community { get; set; } = "public";
    public int SnmpPort { get; set; } = 161;
    public string SnmpVersion { get; set; } = "v2c";
    public string Status { get; set; } = "unknown";
    public string OsVersion { get; set; } = string.Empty;

    public Dictionary<string, string> Interfaces { get; set; } = new();
    public Dictionary<string, object> RawData { get; set; } = new();
}
