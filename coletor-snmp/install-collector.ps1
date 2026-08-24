# Inner SNMP Collector - Instalador Automático
# Versão: 1.0.0
# Requer: Windows Server com .NET 8 SDK

param(
    [Parameter(Mandatory=$true)]
    [string]$PortalUrl,

    [Parameter(Mandatory=$true)]
    [string]$ActivationToken,

    [string]$InstallPath = "$env:ProgramFiles\InnerSnmpCollector",

    [string]$IpRangeStart = "192.168.1.1",

    [string]$IpRangeEnd = "192.168.1.254",

    [string]$CommunityString = "public",

    [string]$SnmpVersion = "2c",

    [int]$IntervalSeconds = 300
)

$ErrorActionPreference = "Stop"
$Script:Version = "1.0.0"
$Script:ProjectName = "SnmpCollector"
$Script:RepoUrl = "https://github.com/innerworks/inner-snmp-collector"

function Write-InstallLog {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "$timestamp [$Level] $Message"
    Write-Host $logMessage
    $logFile = "$InstallPath\install.log"
    if (Test-Path (Split-Path $logFile -Parent)) {
        Add-Content -Path $logFile -Value $logMessage
    }
}

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Invoke-Enrollment {
    Write-InstallLog "Solicitando registro do coletor ao portal..."

    try {
        $headers = @{
            "Content-Type" = "application/json"
        }

        $body = @{
            activation_token = $ActivationToken
            agent_type = "collector"
            hostname = $env:COMPUTERNAME
            ip_address = (Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Manual, Dhcp | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1).IPAddress
            os_info = "Windows $($env:OSVERSION_STR)"
            version = $Script:Version
        } | ConvertTo-Json

        $response = Invoke-RestMethod -Uri "$PortalUrl/api/agent/enroll" `
            -Method Post `
            -Headers $headers `
            -Body $body `
            -TimeoutSec 30

        if ($response.status -eq "success") {
            Write-InstallLog "Registro concluído com sucesso!" "SUCCESS"
            return @{
                success = $true
                assetKey = $response.asset_key
                agentSecret = $response.agent_secret
                agentId = $response.agent_id
            }
        } else {
            Write-InstallLog "Registro falhou: $($response.error)" "ERROR"
            return @{ success = $false; error = $response.error }
        }
    } catch {
        Write-InstallLog "Erro ao conectar com portal: $_" "ERROR"
        return @{ success = $false; error = $_.Exception.Message }
    }
}

function Test-DotNetInstalled {
    try {
        $dotnetVersion = dotnet --version 2>$null
        if ($dotnetVersion) {
            Write-InstallLog ".NET SDK $dotnetVersion detectado"
            return $true
        }
    } catch {}
    return $false
}

function Create-CollectorConfig {
    param(
        [string]$AssetKey,
        [string]$AgentSecret
    )

    $config = @{
        portalUrl = $PortalUrl
        assetKey = $AssetKey
        agentSecret = $AgentSecret
        collector = @{
            name = $env:COMPUTERNAME
            intervalSeconds = $IntervalSeconds
            ipRangeStart = $IpRangeStart
            ipRangeEnd = $IpRangeEnd
            communityString = $CommunityString
            snmpVersion = $SnmpVersion
            snmpPort = 161
        }
    }

    return $config
}

function Install-CollectorService {
    param(
        [hashtable]$Config,
        [string]$AgentSecret
    )

    Write-InstallLog "Baixando código fonte do coletor..."

    # Criar diretório de trabalho
    $workPath = "$env:TEMP\InnerSnmpCollector_$(Get-Random)"
    New-Item -ItemType Directory -Path $workPath -Force | Out-Null

    try {
        # Criar projeto .NET
        Write-InstallLog "Criando projeto .NET..."
        Push-Location $workPath
        dotnet new console -n $Script:ProjectName -f net8.0 --force | Out-Null

        # Criar arquivos do projeto
        $projectPath = "$workPath\$Script:ProjectName"
        Set-Location $projectPath

        # Atualizar .csproj
        $csproj = @"
<Project Sdk="Microsoft.NET.Sdk">

  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <AssemblyName>InnerSnmpCollector</AssemblyName>
  </PropertyGroup>

</Project>
"@
        $csproj | Out-File -FilePath "$projectPath\$Script:ProjectName.csproj" -Encoding UTF8

        # Criar Program.cs
        $programCs = @"
// Inner SNMP Collector
// Versão: $Script:Version

using System.Text.Json;

var configPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "config.json");
if (args.Length > 0) configPath = args[0];

if (!File.Exists(configPath))
{
    Console.WriteLine($"Configuração não encontrada: {configPath}");
    return 1;
}

var configJson = File.ReadAllText(configPath);
var config = JsonSerializer.Deserialize<CollectorConfig>(configJson) ?? throw new Exception("Config inválida");

Console.WriteLine($"Inner SNMP Collector v$Script:Version");
Console.WriteLine($"Portal: {config.portalUrl}");
Console.WriteLine($"Intervalo: {config.collector.intervalSeconds}s");
Console.WriteLine($"Range: {config.collector.ipRangeStart} - {config.collector.ipRangeEnd}");

while (true)
{
    try
    {
        // Simular coleta SNMP (implementação real usa SnmpSharpNet)
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Iniciando coleta SNMP...");

        var devices = DiscoverDevices(config);

        if (devices.Count > 0)
        {
            await SendMetrics(config, devices);
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] {devices.Count} dispositivos enviados");
        }
        else
        {
            Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Nenhum dispositivo encontrado");
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"[{DateTime.Now:HH:mm:ss}] Erro: {ex.Message}");
    }

    Thread.Sleep(config.collector.intervalSeconds * 1000);
}

List<NetworkDevice> DiscoverDevices(CollectorConfig config)
{
    var devices = new List<NetworkDevice>();

    // Parse IP range
    var startParts = config.collector.ipRangeStart.Split('.').Select(int.Parse).ToArray();
    var endParts = config.collector.ipRangeEnd.Split('.').Select(int.Parse).ToArray();

    var startNum = startParts[0] * 256*256*256 + startParts[1] * 256*256 + startParts[2] * 256 + startParts[3];
    var endNum = endParts[0] * 256*256*256 + endParts[1] * 256*256 + endParts[2] * 256 + endParts[3];

    // Limitar a 254 IPs
    endNum = Math.Min(endNum, startNum + 254);

    for (int i = startNum; i <= endNum; i++)
    {
        var ip = $"{i / (256*256*256) % 256}.{i / (256*256) % 256}.{i / 256 % 256}.{i % 256}";

        // Simular SNMP GET - em produção usar SnmpSharpNet
        // var response = snmp.Get(ip, community, "1.3.6.1.2.1.1.1.0");

        // Para MVP, detectar por ping
        var ping = new System.Net.NetworkInformation.Ping();
        var reply = ping.Send(ip, 1000);

        if (reply.Status == System.Net.NetworkInformation.IPStatus.Success)
        {
            devices.Add(new NetworkDevice
            {
                ip_address = ip,
                device_name = $"Device-{ip.Replace('.', '-')}",
                device_type = "Outro",
                status = "Online"
            });
        }
    }

    return devices;
}

async Task SendMetrics(CollectorConfig config, List<NetworkDevice> devices)
{
    using var client = new HttpClient();
    client.DefaultRequestHeaders.Add("x-agent-secret", config.agentSecret);

    var payload = new
    {
        asset_key = config.assetKey,
        devices = devices
    };

    var content = new StringContent(
        JsonSerializer.Serialize(payload),
        System.Text.Encoding.UTF8,
        "application/json"
    );

    var response = await client.PostAsync($"{config.portalUrl}/api/agent/collector/metrics", content);

    if (!response.IsSuccessStatusCode)
    {
        throw new Exception($"API retornou: {response.StatusCode}");
    }
}

class CollectorConfig
{
    public string portalUrl { get; set; } = "";
    public string assetKey { get; set; } = "";
    public string agentSecret { get; set; } = "";
    public CollectorSettings collector { get; set; } = new();
}

class CollectorSettings
{
    public string name { get; set; } = "";
    public int intervalSeconds { get; set; } = 300;
    public string ipRangeStart { get; set; } = "192.168.1.1";
    public string ipRangeEnd { get; set; } = "192.168.1.254";
    public string communityString { get; set; } = "public";
    public string snmpVersion { get; set; } = "2c";
    public int snmpPort { get; set; } = 161;
}

class NetworkDevice
{
    public string ip_address { get; set; } = "";
    public string device_name { get; set; } = "";
    public string device_type { get; set; } = "";
    public string status { get; set; } = "";
}
"@
        $programCs | Out-File -FilePath "$projectPath\Program.cs" -Encoding UTF8

        # Build
        Write-InstallLog "Compilando projeto..."
        dotnet build -c Release | Out-Null

        # Copiar para diretório de instalação
        if (-not (Test-Path $InstallPath)) {
            New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        }

        Copy-Item -Path "$projectPath\bin\Release\net8.0\*" -Destination $InstallPath -Recurse -Force

        # Salvar config
        $configJson = JsonSerializer.Serialize($Config, new JsonSerializerOptions { WriteIndented = true })
        $configJson | Out-File -FilePath "$InstallPath\config.json" -Encoding UTF8

        Write-InstallLog "Instalação copiada para: $InstallPath"

        return $true
    }
    finally {
        Pop-Location
        Remove-Item -Path $workPath -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Register-WindowsService {
    param([string]$ServiceName = "InnerSnmpCollector")

    Write-InstallLog "Registrando como serviço Windows..."

    # Verificar se já existe
    $existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-InstallLog "Serviço já existe. Removendo..." "WARN"
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Start-Sleep -Seconds 2
    }

    # Criar serviço
    $exePath = "$InstallPath\InnerSnmpCollector.exe"
    sc.exe create $ServiceName binPath= "$exePath `"$InstallPath\config.json`"" start= auto DisplayName= "Inner SNMP Collector" type= own
    sc.exe description $ServiceName "Coletor SNMP Inner - Monitoramento de rede"

    Write-InstallLog "Serviço criado: $ServiceName"

    # Iniciar
    Start-Service -Name $ServiceName
    Write-InstallLog "Serviço iniciado!" "SUCCESS"
}

# ============================================
# INÍCIO DA INSTALAÇÃO
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner SNMP Collector - Instalador" -ForegroundColor Cyan
Write-Host "  Versão $Script:Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar administrator
if (-not (Test-Administrator)) {
    Write-Host "ERRO: Este instalador precisa ser executado como Administrador." -ForegroundColor Red
    Write-Host "Clique direito > Executar como Administrador" -ForegroundColor Yellow
    exit 1
}

Write-InstallLog "Iniciando instalação..."
Write-InstallLog "Portal: $PortalUrl"
Write-InstallLog "IP Range: $IpRangeStart - $IpRangeEnd"

# Verificar .NET
if (-not (Test-DotNetInstalled)) {
    Write-Host ""
    Write-Host "AVISO: .NET SDK não detectado." -ForegroundColor Yellow
    Write-Host "Instalando .NET 8 SDK..." -ForegroundColor Cyan

    $dotnetInstaller = "$env:TEMP\dotnet-install.ps1"
    Invoke-WebRequest -Uri "https://dot.net/v1/dotnet-install.ps1" -OutFile $dotnetInstaller -UseBasicParsing
    & $dotnetInstaller -Channel 8.0 -InstallDir "$env:ProgramFiles\dotnet"

    if (-not (Test-DotNetInstalled)) {
        Write-Host "FALHA ao instalar .NET SDK." -ForegroundColor Red
        Write-Host "Instale manualmente: https://dotnet.microsoft.com/download" -ForegroundColor Yellow
        exit 1
    }

    # Adicionar ao PATH
    $env:PATH = "$env:ProgramFiles\dotnet;$env:PATH"
}

# Executar enrollment
$result = Invoke-Enrollment
if (-not $result.success) {
    Write-Host ""
    Write-Host "FALHA no registro: $($result.error)" -ForegroundColor Red
    Write-Host "Verifique o Token de Ativação e a conexão com o portal." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  REGISTRO CONCLUÍDO!" -ForegroundColor Green
Write-Host "  Asset Key: $($result.assetKey)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Criar configuração
$config = Create-CollectorConfig -AssetKey $result.assetKey -AgentSecret $result.agentSecret

# Compilar e instalar
Write-Host "Compilando coletor SNMP..." -ForegroundColor Cyan
$installed = Install-CollectorService -Config $config -AgentSecret $result.agentSecret

if ($installed) {
    # Registrar como serviço
    Register-WindowsService

    # Criar uninstall
    @"
@echo off
sc stop InnerSnmpCollector
sc delete InnerSnmpCollector
rmdir /s /q "%ProgramFiles%\InnerSnmpCollector"
echo Inner SNMP Collector removido com sucesso.
"@ | Out-File -FilePath "$InstallPath\uninstall.bat" -Encoding ASCII

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "O Inner SNMP Collector está rodando como serviço." -ForegroundColor White
    Write-Host ""
    Write-Host "Para verificar:" -ForegroundColor White
    Write-Host "  Get-Service InnerSnmpCollector" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para ver logs:" -ForegroundColor White
    Write-Host "  Get-WinEvent -FilterHashtable @{LogName='Application';Source='InnerSnmpCollector'}" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "FALHA ao compilar/instalar." -ForegroundColor Red
    exit 1
}
