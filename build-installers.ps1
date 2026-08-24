# Inner PAINEL - Build de Instaladores
# Gera os instaladores visuais usando Inno Setup

param(
    [ValidateSet("all", "agent", "collector")]
    [string]$Target = "all",

    [string]$InnoSetupPath = "C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
)

$ErrorActionPreference = "Stop"
$Script:Version = "1.0.0"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner PAINEL - Build de Instaladores" -ForegroundColor Cyan
Write-Host "  Versao $Script:Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

function Test-InnoSetup {
    if (Test-Path $InnoSetupPath) {
        return $true
    }

    $altPaths = @(
        "C:\Program Files (x86)\Inno Setup 6\ISCC.exe",
        "C:\Program Files\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe"
    )

    foreach ($path in $altPaths) {
        if (Test-Path $path) {
            $script:InnoSetupPath = $path
            return $true
        }
    }

    return $false
}

function Build-AgentInstaller {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Compilando Inner Agent..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    $agentDir = "$projectRoot\agente"
    $issFile = "$agentDir\installer.iss"

    if (-not (Test-Path $issFile)) {
        Write-Host "ERRO: Script Inno Setup nao encontrado: $issFile" -ForegroundColor Red
        return $false
    }

    # Preparar arquivos
    $installDir = "$agentDir\install"
    if (-not (Test-Path $installDir)) {
        New-Item -ItemType Directory -Path $installDir -Force | Out-Null
    }

    # Script do Agente com Enrollment
    $agentScript = @"
# Inner Agent - Script de Monitoramento
# Versao: 1.0.0

param(
    [string]`$PortalUrl = "",
    [string]`$ActivationToken = "",
    [int]`$IntervalSeconds = 60
)

`$ErrorActionPreference = "Continue"
`$Script:Version = "1.0.0"
`$Script:ConfigFile = "`$PSScriptRoot\config.json"
`$Script:LogFile = "`$PSScriptRoot\agent.log"

# Carregar config do arquivo
if (Test-Path `$Script:ConfigFile) {
    `$config = Get-Content `$Script:ConfigFile | ConvertFrom-Json
    if (-not `$PortalUrl) { `$PortalUrl = `$config.portalUrl }
    if (-not `$ActivationToken) { `$ActivationToken = `$config.token }
    if (`$config.assetKey) { `$Script:AssetKey = `$config.assetKey }
    if (`$config.agentSecret) { `$Script:AgentSecret = `$config.agentSecret }
    if (`$config.intervalSeconds) { `$IntervalSeconds = `$config.intervalSeconds }
}

function Write-Log {
    param([string]`$Message, [string]`$Level = "INFO")
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    `$logLine = "`$timestamp [``$Level] `$Message"
    Write-Host `$logLine
    Add-Content -Path `$Script:LogFile -Value `$logLine -ErrorAction SilentlyContinue
}

function Invoke-Enrollment {
    Write-Log "Iniciando enrollment no portal..."

    `$body = @{
        activation_token = `$ActivationToken
        agent_type = "endpoint"
        hostname = `$env:COMPUTERNAME
        ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { `$_.InterfaceAlias -notmatch "Loopback|Loopback Pseudo-Interface" } | Select-Object -First 1).IPAddress
        os_info = "Windows"
        version = `$Script:Version
    } | ConvertTo-Json

    try {
        `$response = Invoke-RestMethod -Uri "`$PortalUrl/api/agent/enroll" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body `$body `
            -TimeoutSec 30

        if (`$response.status -eq "success") {
            Write-Log "Enrollment realizado com sucesso!" "SUCCESS"
            return @{
                success = `$true
                assetKey = `$response.asset_key
                agentSecret = `$response.agent_secret
                agentId = `$response.agent_id
            }
        } else {
            Write-Log "Enrollment falhou: `$(`$response.error)" "ERROR"
            return @{ success = `$false; error = `$response.error }
        }
    } catch {
        Write-Log "Erro ao conectar com portal: `$_" "ERROR"
        return @{ success = `$false; error = `$_.Exception.Message }
    }
}

function Get-HostMetrics {
    try {
        `$cpu = (Get-Counter '\\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue
        `$os = Get-CimInstance Win32_OperatingSystem
        `$totalMem = [math]::Round(`$os.TotalVisibleMemorySize / 1024)
        `$freeMem = [math]::Round(`$os.FreePhysicalMemory / 1024)
        `$usedMem = `$totalMem - `$freeMem
        `$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
        `$totalDisk = [math]::Round(`$disk.Size / 1GB, 2)
        `$freeDisk = [math]::Round(`$disk.FreeSpace / 1GB, 2)
        `$usedDisk = `$totalDisk - `$freeDisk

        return @{
            cpu_percent = [math]::Round(`$cpu, 2)
            memory_percent = [math]::Round((`$usedMem / `$totalMem) * 100, 2)
            memory_total_mb = `$totalMem
            memory_used_mb = `$usedMem
            disk_percent = [math]::Round((`$usedDisk / `$totalDisk) * 100, 2)
            disk_total_gb = `$totalDisk
            disk_used_gb = `$usedDisk
            uptime_seconds = [int]((Get-Date) - `$os.LastBootUpTime).TotalSeconds
        }
    } catch {
        Write-Log "Erro ao coletar metricas: `$_" "WARN"
        return `$null
    }
}

function Get-VMs {
    try {
        `$hyperV = Get-Module -ListAvailable -Name Hyper-V -ErrorAction SilentlyContinue
        if (-not `$hyperV) { return @() }

        Import-Module Hyper-V -ErrorAction SilentlyContinue

        return @(Get-VM | ForEach-Object {
            @{
                name = `$_.VMName
                cpu_percent = if (`$_.ProcessorUsage) { [math]::Round(`$_.ProcessorUsage, 2) } else { 0 }
                memory_percent = 0
                memory_total_mb = [math]::Round(`$_.MemoryStartup / 1MB)
                memory_used_mb = [math]::Round(`$_.MemoryAssigned / 1MB)
                status = `$_.State.ToString()
            }
        })
    } catch {
        return @()
    }
}

function Send-Metrics {
    param(`$HostMetrics, `$VMs)

    `$body = @{
        asset_key = `$Script:AssetKey
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = `$HostMetrics
        virtual_machines = `$VMs
        partial = (-not `$HostMetrics)
    } | ConvertTo-Json -Depth 5

    try {
        Invoke-RestMethod -Uri "`$PortalUrl/api/agent/metrics/v2" `
            -Method Post `
            -Headers @{
                "Content-Type" = "application/json"
                "x-agent-secret" = `$Script:AgentSecret
            } `
            -Body `$body `
            -TimeoutSec 30 | Out-Null

        return `$true
    } catch {
        Write-Log "Erro ao enviar metricas: `$_" "WARN"
        `$Script:OfflineBuffer += @{ timestamp = Get-Date; host = `$HostMetrics; vms = `$VMs }
        if (`$Script:OfflineBuffer.Count -gt 10) { `$Script:OfflineBuffer = `$Script:OfflineBuffer[-10..-1] }
        return `$false
    }
}

function Send-Heartbeat {
    try {
        Invoke-RestMethod -Uri "`$PortalUrl/api/agent/heartbeat" `
            -Method Post `
            -Headers @{
                "Content-Type" = "application/json"
                "x-agent-secret" = `$Script:AgentSecret
            } `
            -Body (@{ asset_key = `$Script:AssetKey; status = "online" } | ConvertTo-Json) `
            -TimeoutSec 15 | Out-Null

        `$Script:LastHeartbeat = Get-Date
        return `$true
    } catch {
        return `$false
    }
}

# ============================================
# INICIALIZACAO
# ============================================

Write-Log "========================================" "INFO"
Write-Log "Inner Agent v`$Script:Version" "INFO"
Write-Log "========================================" "INFO"

# Validar configuracao
if (-not `$PortalUrl) {
    Write-Log "ERRO: URL do portal nao configurada" "ERROR"
    Write-Log "Edite o arquivo config.json ou passe -PortalUrl" "ERROR"
    exit 1
}

if (-not `$ActivationToken) {
    Write-Log "ERRO: Token de ativacao nao configurado" "ERROR"
    Write-Log "Edite o arquivo config.json ou passe -ActivationToken" "ERROR"
    exit 1
}

# Variaveis globais
`$Script:AssetKey = `$null
`$Script:AgentSecret = `$null
`$Script:OfflineBuffer = @()
`$Script:LastHeartbeat = Get-Date

# Fazer enrollment se nao tiver credenciais
if (-not `$Script:AssetKey) {
    `$enrollment = Invoke-Enrollment
    if (-not `$enrollment.success) {
        Write-Log "FALHA no enrollment. Agente continuara tentando..." "ERROR"
        Write-Log "Motivo: `$(`$enrollment.error)" "ERROR"
    } else {
        `$Script:AssetKey = `$enrollment.assetKey
        `$Script:AgentSecret = `$enrollment.agentSecret

        # Salvar credenciais no config para uso futuro
        `$newConfig = @{
            portalUrl = `$PortalUrl
            token = `$ActivationToken
            assetKey = `$Script:AssetKey
            agentSecret = `$Script:AgentSecret
            intervalSeconds = `$IntervalSeconds
        }
        `$newConfig | ConvertTo-Json | Out-File -FilePath `$Script:ConfigFile -Encoding UTF8

        Write-Log "Asset Key: `$(`$Script:AssetKey)" "SUCCESS"
    }
}

Write-Log "Iniciando loop de metricas (intervalo: `${IntervalSeconds}s)" "INFO"

# ============================================
# LOOP PRINCIPAL
# ============================================

while (`$true) {
    # Verificar se tem credenciais
    if (-not `$Script:AssetKey) {
        Write-Log "Tentando enrollment novamente..." "WARN"
        `$enrollment = Invoke-Enrollment
        if (`$enrollment.success) {
            `$Script:AssetKey = `$enrollment.assetKey
            `$Script:AgentSecret = `$enrollment.agentSecret
            Write-Log "Enrollment realizado com sucesso!" "SUCCESS"
        } else {
            Write-Log "Enrollment falhou. Aguardando ${IntervalSeconds}s..." "WARN"
            Start-Sleep -Seconds `$IntervalSeconds
            continue
        }
    }

    # Coletar metricas
    `$metrics = Get-HostMetrics
    `$vms = Get-VMs

    if (`$metrics) {
        # Enviar metricas
        `$sent = Send-Metrics -HostMetrics `$metrics -VMs `$vms
        if (`$sent) {
            Write-Log "Metricas: CPU=`$(`$metrics.cpu_percent)%, RAM=`$(`$metrics.memory_percent)%, Disk=`$(`$metrics.disk_percent)%" "INFO"
        }

        # Tentar enviar metricas em buffer
        foreach (`$entry in `$Script:OfflineBuffer) {
            if (Send-Metrics -HostMetrics `$entry.host -VMs `$entry.vms) {
                Write-Log "Metrica em buffer enviada com sucesso" "INFO"
                `$Script:OfflineBuffer = `$Script:OfflineBuffer | Where-Object { `$_.timestamp -ne `$entry.timestamp }
            }
        }
    } else {
        Write-Log "Nao foi possivel coletar metricas do host" "WARN"
    }

    # Enviar heartbeat a cada 5 minutos
    if (((Get-Date) - `$Script:LastHeartbeat).TotalSeconds -ge 300) {
        if (Send-Heartbeat) {
            Write-Log "Heartbeat enviado" "INFO"
        }
    }

    Start-Sleep -Seconds `$IntervalSeconds
}
"@

    $agentScript | Out-File -FilePath "$installDir\agent.ps1" -Encoding UTF8

    # Template de config
    @"
{
    "portalUrl": "https://portal.inner.com.br",
    "token": "INNER-KEY-XXXX",
    "intervalSeconds": 60
}
"@ | Out-File -FilePath "$installDir\config.json" -Encoding UTF8

    # Compilar
    Write-Host "Compilando instalador..." -ForegroundColor Cyan
    & $InnoSetupPath $issFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sucesso! Instalador gerado em: $agentDir\installer" -ForegroundColor Green
        return $true
    } else {
        Write-Host "ERRO na compilacao. Codigo: $LASTEXITCODE" -ForegroundColor Red
        return $false
    }
}

function Build-CollectorInstaller {
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "  Compilando Inner SNMP Collector..." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow

    $collectorDir = "$projectRoot\coletor-snmp"
    $issFile = "$collectorDir\installer.iss"

    if (-not (Test-Path $issFile)) {
        Write-Host "ERRO: Script Inno Setup nao encontrado: $issFile" -ForegroundColor Red
        return $false
    }

    # Verificar se ha build .NET
    $publishDir = "$collectorDir\publish"
    if (-not (Test-Path $publishDir)) {
        Write-Host "Build do projeto .NET necessario primeiro..." -ForegroundColor Yellow
        Write-Host "Executando: dotnet publish..." -ForegroundColor Cyan
        Push-Location $collectorDir
        dotnet publish -c Release -r win-x64 --self-contained true -o $publishDir
        Pop-Location
    }

    # Compilar
    Write-Host "Compilando instalador..." -ForegroundColor Cyan
    & $InnoSetupPath $issFile

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Sucesso! Instalador gerado em: $collectorDir\installer" -ForegroundColor Green
        return $true
    } else {
        Write-Host "ERRO na compilacao. Codigo: $LASTEXITCODE" -ForegroundColor Red
        return $false
    }
}

# ============================================
# MAIN
# ============================================

# Verificar Inno Setup
if (-not (Test-InnoSetup)) {
    Write-Host ""
    Write-Host "ERRO: Inno Setup 6 nao encontrado!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Baixe em: https://jrsoftware.org/isinfo.php" -ForegroundColor Yellow
    Write-Host "Instalacao padrao: C:\Program Files (x86)\Inno Setup 6" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host "Inno Setup encontrado: $InnoSetupPath" -ForegroundColor Green
Write-Host ""

$results = @()

if ($Target -in @("all", "agent")) {
    $results += @{ Name = "Agent"; Success = Build-AgentInstaller }
}

if ($Target -in @("all", "collector")) {
    $results += @{ Name = "Collector"; Success = Build-CollectorInstaller }
}

# Resultado
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  RESULTADO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

foreach ($r in $results) {
    $status = if ($r.Success) { "OK" } else { "FALHA" }
    $color = if ($r.Success) { "Green" } else { "Red" }
    Write-Host "  $($r.Name): $status" -ForegroundColor $color
}

Write-Host ""
Write-Host "Instaladores gerados em:" -ForegroundColor White
Write-Host "  $projectRoot\agente\installer" -ForegroundColor Gray
Write-Host "  $projectRoot\coletor-snmp\installer" -ForegroundColor Gray
Write-Host ""
