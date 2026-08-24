namespace ColetorSNMP.Models;

public class AppConfig
{
    public string ApiBaseUrl { get; set; } = "http://localhost:3000";
    public string ApiToken { get; set; } = string.Empty;
    public string Community { get; set; } = "public";
    public int SnmpTimeoutMs { get; set; } = 3000;
    public int MaxConcurrentScans { get; set; } = 10;
    public int ScanIntervalMinutes { get; set; } = 60;
    public int MaxIpsPerScan { get; set; } = 254;
    public bool RunAsService { get; set; } = false;
    public int ServicePort { get; set; } = 9050;
    public List<IpRange> ScanRanges { get; set; } = new();
    public LoggingConfig Logging { get; set; } = new();
}

public class IpRange
{
    public string Start { get; set; } = string.Empty;
    public string End { get; set; } = string.Empty;
    public string Community { get; set; } = "public";
}

public class LoggingConfig
{
    public string Level { get; set; } = "Information";
    public bool Console { get; set; } = true;
    public string? FilePath { get; set; }
}
