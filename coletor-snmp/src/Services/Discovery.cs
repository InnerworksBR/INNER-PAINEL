using System.Net;

namespace ColetorSNMP.Services;

public class Discovery
{
    private readonly SnmpClient _snmpClient;
    private readonly ILogger<Discovery> _logger;
    private readonly int _maxConcurrent;
    private readonly int _maxIps;

    public Discovery(SnmpClient snmpClient, int maxConcurrent, int maxIps, ILogger<Discovery> logger)
    {
        _snmpClient = snmpClient;
        _maxConcurrent = maxConcurrent;
        _maxIps = maxIps;
        _logger = logger;
    }

    /// <summary>
    /// Gera lista de IPs entre start e end (IPv4)
    /// Limita a MaxIps por execução
    /// </summary>
    public IEnumerable<string> GenerateIpRange(string startIp, string endIp)
    {
        if (!IPAddress.TryParse(startIp, out var start) ||
            !IPAddress.TryParse(endIp, out end))
        {
            _logger.LogError("IPs invalidos: {Start} - {End}", startIp, endIp);
            yield break;
        }

        var startBytes = start.GetAddressBytes();
        var endBytes = end.GetAddressBytes();

        if (startBytes.Length != 4 || endBytes.Length != 4)
        {
            _logger.LogError("Apenas IPv4 suportado");
            yield break;
        }

        // Converte para inteiro para facilitar iteração
        var startInt = BitConverter.ToUInt32(startBytes.Reverse().ToArray(), 0);
        var endInt = BitConverter.ToUInt32(endBytes.Reverse().ToArray(), 0);

        if (startInt > endInt)
        {
            (startInt, endInt) = (endInt, startInt);
        }

        // Limita a quantidade de IPs
        var count = 0;
        var maxCount = Math.Min(_maxIps, endInt - startInt + 1);

        for (var i = startInt; i <= endInt && count < maxCount; i++)
        {
            var ipBytes = BitConverter.GetBytes(i).Reverse().ToArray();
            yield return new IPAddress(ipBytes).ToString();
            count++;
        }

        _logger.LogInformation("Gerados {Count} IPs de {Start} ate {End}", count, startIp, endIp);
    }

    /// <summary>
    /// Descobre dispositivos na rede usando SNMP
    /// </summary>
    public async Task<List<Models.NetworkDevice>> DiscoverAsync(
        string startIp,
        string endIp,
        string community,
        CancellationToken cancellationToken = default)
    {
        var devices = new List<Models.NetworkDevice>();
        var ips = GenerateIpRange(startIp, endIp).ToList();

        _logger.LogInformation("Iniciando descoberta em {Count} IPs: {Start} - {End}",
            ips.Count, startIp, endIp);

        var semaphore = new SemaphoreSlim(_maxConcurrent);
        var tasks = new List<Task<Models.NetworkDevice?>>();

        foreach (var ip in ips)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            await semaphore.WaitAsync(cancellationToken);

            tasks.Add(Task.Run(async () =>
            {
                try
                {
                    return await DiscoverDeviceAsync(ip, community);
                }
                finally
                {
                    semaphore.Release();
                }
            }, cancellationToken));
        }

        var results = await Task.WhenAll(tasks);

        foreach (var device in results.Where(d => d != null))
        {
            devices.Add(device!);
        }

        _logger.LogInformation("Descoberta concluida: {Count} dispositivos encontrados",
            devices.Count);

        return devices;
    }

    /// <summary>
    /// Descobre um dispositivo específico via SNMP
    /// </summary>
    private async Task<Models.NetworkDevice?> DiscoverDeviceAsync(string ip, string community)
    {
        try
        {
            _logger.LogDebug("Testando IP: {Ip}", ip);

            // Coleta dados SNMP
            var snmpData = await _snmpClient.GetSnmpDataAsync(ip, community);

            if (!snmpData.ContainsKey("sysDescr") || string.IsNullOrEmpty(snmpData["sysDescr"]))
            {
                _logger.LogDebug("IP {Ip} sem resposta SNMP", ip);
                return null;
            }

            // Verifica se realmente tem sysDescr (não é apenas ping)
            var sysDescr = snmpData["sysDescr"];
            if (sysDescr.Contains("Simulated", StringComparison.OrdinalIgnoreCase))
            {
                // Para demos, aceita dados simulados
                _logger.LogDebug("IP {Ip} respondendo SNMP (simulado)", ip);
            }

            var device = new Models.NetworkDevice
            {
                IpAddress = ip,
                Description = snmpData.GetValueOrDefault("sysDescr", ""),
                Hostname = snmpData.GetValueOrDefault("sysName", ip),
                Location = snmpData.GetValueOrDefault("sysLocation", ""),
                InterfaceCount = int.TryParse(snmpData.GetValueOrDefault("ifNumber", "0"), out var count) ? count : 0,
                Community = community,
                IsReachable = true,
                LastSeen = DateTime.UtcNow
            };

            // Tenta extrair Uptime
            if (long.TryParse(snmpData.GetValueOrDefault("sysUpTime", "0"), out var uptime))
            {
                device.UptimeSeconds = uptime / 100; // SNMP uptime está em centisegundos
            }

            // Parseia tipo do dispositivo
            var parser = new DeviceParser();
            var (deviceType, manufacturer) = parser.ParseDeviceType(sysDescr);
            device.DeviceType = deviceType;
            device.Manufacturer = manufacturer;

            // Extrai informações do sysDescr
            parser.ExtractDeviceInfo(sysDescr, device);

            _logger.LogInformation("Dispositivo encontrado: {Ip} - {Type} ({Manufacturer})",
                ip, device.DeviceType, device.Manufacturer);

            return device;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao descobrir dispositivo em {Ip}", ip);
            return null;
        }
    }

    /// <summary>
    /// Verifica se um IP está no ar
    /// </summary>
    public async Task<bool> IsHostAliveAsync(string ip)
    {
        return await _snmpClient.TestSnmpReachabilityAsync(ip);
    }

    /// <summary>
    /// Retorna estatísticas da rede escaneada
    /// </summary>
    public async Task<DiscoveryStats> GetNetworkStatsAsync(string startIp, string endIp)
    {
        var stats = new DiscoveryStats();
        var ips = GenerateIpRange(startIp, endIp).ToList();

        var semaphore = new SemaphoreSlim(_maxConcurrent);
        var tasks = new List<Task<bool>>();

        foreach (var ip in ips)
        {
            await semaphore.WaitAsync();
            tasks.Add(Task.Run(async () =>
            {
                try
                {
                    return await IsHostAliveAsync(ip);
                }
                finally
                {
                    semaphore.Release();
                }
            }));
        }

        var results = await Task.WhenAll(tasks);

        stats.TotalIps = results.Length;
        stats.AliveHosts = results.Count(r => r);
        stats.ResponsiveToSnmp = 0; // Contado na descoberta real

        return stats;
    }
}

public class DiscoveryStats
{
    public int TotalIps { get; set; }
    public int AliveHosts { get; set; }
    public int ResponsiveToSnmp { get; set; }
    public DateTime ScanTime { get; set; } = DateTime.UtcNow;
}
