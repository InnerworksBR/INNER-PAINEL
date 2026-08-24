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

    # Procurar em outros locais
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

    # Copiar script do agente
    $agentScript = @"
param(
    `$PortalUrl = "",
    `$Token = "",
    `$IntervalSeconds = 60
)

`$ErrorActionPreference = "SilentlyContinue"
`$Script:HostName = `$env:COMPUTERNAME
`$Script:LastHeartbeat = Get-Date
`$Script:OfflineBuffer = @()
`$Script:ConfigFile = "`$PSScriptRoot\config.json"

# Carregar config
if (Test-Path `$Script:ConfigFile) {
    `$config = Get-Content `$Script:ConfigFile | ConvertFrom-Json
    if (-not `$PortalUrl) { `$PortalUrl = `$config.portalUrl }
    if (-not `$Token) { `$Token = `$config.token }
    if (-not `$IntervalSeconds) { `$IntervalSeconds = `$config.intervalSeconds }
}

function Write-Log {
    param([string]`$Message, [string]`$Level = "INFO")
    `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "`$timestamp [``$Level] ``$Message"
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
        }
    } catch { return `$null }
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
                memory_total_mb = [math]::Round(`$_.MemoryStartup / 1MB)
                memory_used_mb = [math]::Round(`$_.MemoryAssigned / 1MB)
                status = `$_.State.ToString()
            }
        })
    } catch { return @() }
}

function Send-Metrics {
    param(`$HostMetrics, `$VMs)

    `$body = @{
        asset_key = `$Token
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = `$HostMetrics
        virtual_machines = `$VMs
    } | ConvertTo-Json -Depth 5

    try {
        Invoke-RestMethod -Uri "`$PortalUrl/api/agent/metrics/v2" `
            -Method Post `
            -Headers @{ "Content-Type" = "application/json" } `
            -Body `$body -TimeoutSec 30 | Out-Null
        return `$true
    } catch {
        `$Script:OfflineBuffer += @{ host = `$HostMetrics; vms = `$VMs }
        if (`$Script:OfflineBuffer.Count -gt 10) { `$Script:OfflineBuffer = `$Script:OfflineBuffer[-10..-1] }
        return `$false
    }
}

Write-Log "Inner Agent started - Portal: `$PortalUrl"

while (`$true) {
    `$metrics = Get-HostMetrics
    `$vms = Get-VMs
    if (`$metrics) {
        Send-Metrics -HostMetrics `$metrics -VMs `$vms
    }
    Start-Sleep -Seconds `$IntervalSeconds
}
"@

    $agentScript | Out-File -FilePath "$installDir\agent.ps1" -Encoding UTF8

    # Template de config
    @"
{
    "portalUrl": "https://portal.inner.com.br",
    "token": "INNER-SRV-XXXX",
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

    # Verificar se ha build
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
