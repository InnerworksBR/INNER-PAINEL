# Inner Agent - Script de Monitoramento v1.0.0

param(
    [string]$PortalUrl = "",
    [string]$ActivationToken = "",
    [int]$IntervalSeconds = 60
)

$ErrorActionPreference = "Continue"
$Script:Version = "1.0.0"
$Script:ConfigFile = "$PSScriptRoot\config.json"
$Script:LogFile = "$PSScriptRoot\agent.log"

# Carregar config do arquivo
if (Test-Path $Script:ConfigFile) {
    $config = Get-Content $Script:ConfigFile | ConvertFrom-Json
    if (-not $PortalUrl) { $PortalUrl = $config.portalUrl }
    if (-not $ActivationToken) { $ActivationToken = $config.token }
    if ($config.assetKey) { $Script:AssetKey = $config.assetKey }
    if ($config.agentSecret) { $Script:AgentSecret = $config.agentSecret }
    if ($config.intervalSeconds) { $IntervalSeconds = $config.intervalSeconds }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "$timestamp [$Level] $Message"
    Write-Host $logLine
    Add-Content -Path $Script:LogFile -Value $logLine -ErrorAction SilentlyContinue
}

function Invoke-Enrollment {
    Write-Log "Iniciando enrollment no portal..."

    $hostname = $env:COMPUTERNAME
    $ipAddress = "unknown"

    try {
        $netIP = Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback" } | Select-Object -First 1
        if ($netIP) { $ipAddress = $netIP.IPAddress }
    } catch {}

    $body = @{
        activation_token = $ActivationToken
        agent_type = "endpoint"
        hostname = $hostname
        ip_address = $ipAddress
        os_info = "Windows"
        version = $Script:Version
    }

    $bodyJson = $body | ConvertTo-Json

    try {
        $params = @{
            Uri = "$PortalUrl/api/agent/enroll"
            Method = "Post"
            ContentType = "application/json"
            Body = $bodyJson
            TimeoutSec = 30
        }

        $response = Invoke-RestMethod @params

        if ($response.status -eq "success") {
            Write-Log "Enrollment realizado com sucesso!" "SUCCESS"
            $Script:AssetKey = $response.asset_key
            $Script:AgentSecret = $response.agent_secret

            # Salvar credenciais
            $newConfig = @{
                portalUrl = $PortalUrl
                token = $ActivationToken
                assetKey = $Script:AssetKey
                agentSecret = $Script:AgentSecret
                intervalSeconds = $IntervalSeconds
            }
            $newConfig | ConvertTo-Json | Out-File -FilePath $Script:ConfigFile -Encoding UTF8

            Write-Log "Asset Key: $($Script:AssetKey)" "SUCCESS"
            return $true
        } else {
            Write-Log "Enrollment falhou: $($response.error)" "ERROR"
            return $false
        }
    } catch {
        Write-Log "Erro ao conectar com portal: $_" "ERROR"
        return $false
    }
}

function Get-HostMetrics {
    try {
        $cpu = (Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue
        $os = Get-CimInstance Win32_OperatingSystem
        $totalMem = [math]::Round($os.TotalVisibleMemorySize / 1024)
        $freeMem = [math]::Round($os.FreePhysicalMemory / 1024)
        $usedMem = $totalMem - $freeMem
        $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
        $totalDisk = [math]::Round($disk.Size / 1GB, 2)
        $freeDisk = [math]::Round($disk.FreeSpace / 1GB, 2)
        $usedDisk = $totalDisk - $freeDisk
        $uptime = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds

        return @{
            cpu_percent = [math]::Round($cpu, 2)
            memory_percent = [math]::Round(($usedMem / $totalMem) * 100, 2)
            memory_total_mb = $totalMem
            memory_used_mb = $usedMem
            disk_percent = [math]::Round(($usedDisk / $totalDisk) * 100, 2)
            disk_total_gb = $totalDisk
            disk_used_gb = $usedDisk
            uptime_seconds = $uptime
        }
    } catch {
        Write-Log "Erro ao coletar metricas: $_" "WARN"
        return $null
    }
}

function Get-VMs {
    try {
        $hyperV = Get-Module -ListAvailable -Name Hyper-V -ErrorAction SilentlyContinue
        if (-not $hyperV) { return @() }

        Import-Module Hyper-V -ErrorAction SilentlyContinue
        $vms = @()

        Get-VM | ForEach-Object {
            $vms += @{
                name = $_.VMName
                cpu_percent = if ($_.ProcessorUsage) { [math]::Round($_.ProcessorUsage, 2) } else { 0 }
                memory_total_mb = [math]::Round($_.MemoryStartup / 1MB)
                memory_used_mb = [math]::Round($_.MemoryAssigned / 1MB)
                status = $_.State.ToString()
            }
        }

        return $vms
    } catch {
        return @()
    }
}

function Send-Metrics {
    param($HostMetrics, $VMs)

    if (-not $Script:AssetKey -or -not $Script:AgentSecret) {
        Write-Log "Credenciais nao disponiveis" "WARN"
        return $false
    }

    $body = @{
        asset_key = $Script:AssetKey
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = $HostMetrics
        virtual_machines = $VMs
        partial = (-not $HostMetrics)
    }

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "x-agent-secret" = $Script:AgentSecret
        }

        $params = @{
            Uri = "$PortalUrl/api/agent/metrics/v2"
            Method = "Post"
            Headers = $headers
            Body = ($body | ConvertTo-Json -Depth 5)
            TimeoutSec = 30
        }

        Invoke-RestMethod @params | Out-Null
        return $true
    } catch {
        Write-Log "Erro ao enviar metricas: $_" "WARN"
        return $false
    }
}

function Send-Heartbeat {
    if (-not $Script:AssetKey -or -not $Script:AgentSecret) {
        return $false
    }

    try {
        $headers = @{
            "Content-Type" = "application/json"
            "x-agent-secret" = $Script:AgentSecret
        }

        $body = @{
            asset_key = $Script:AssetKey
            status = "online"
        }

        $params = @{
            Uri = "$PortalUrl/api/agent/heartbeat"
            Method = "Post"
            Headers = $headers
            Body = ($body | ConvertTo-Json)
            TimeoutSec = 15
        }

        Invoke-RestMethod @params | Out-Null
        $Script:LastHeartbeat = Get-Date
        return $true
    } catch {
        return $false
    }
}

# ============================================
# INICIALIZACAO
# ============================================

Write-Log "========================================" "INFO"
Write-Log "Inner Agent v$Script:Version" "INFO"
Write-Log "========================================" "INFO"

if (-not $PortalUrl) {
    Write-Log "ERRO: URL do portal nao configurada" "ERROR"
    Write-Log "Edite o arquivo config.json" "ERROR"
    exit 1
}

if (-not $ActivationToken) {
    Write-Log "ERRO: Token de ativacao nao configurado" "ERROR"
    Write-Log "Edite o arquivo config.json" "ERROR"
    exit 1
}

$Script:AssetKey = $null
$Script:AgentSecret = $null
$Script:LastHeartbeat = Get-Date

# Fazer enrollment
if (-not $Script:AssetKey) {
    $success = Invoke-Enrollment
    if (-not $success) {
        Write-Log "FALHA no enrollment. Aguardando..." "ERROR"
    }
}

Write-Log "Iniciando loop de metricas (intervalo: ${IntervalSeconds}s)" "INFO"

# ============================================
# LOOP PRINCIPAL
# ============================================

while ($true) {
    # Tentar enrollment se necessario
    if (-not $Script:AssetKey) {
        Write-Log "Tentando enrollment novamente..." "WARN"
        $success = Invoke-Enrollment
        if (-not $success) {
            Start-Sleep -Seconds $IntervalSeconds
            continue
        }
    }

    # Coletar metricas
    $metrics = Get-HostMetrics
    $vms = Get-VMs

    if ($metrics) {
        $sent = Send-Metrics -HostMetrics $metrics -VMs $vms
        if ($sent) {
            Write-Log "Metricas: CPU=$($metrics.cpu_percent)%, RAM=$($metrics.memory_percent)%, Disk=$($metrics.disk_percent)%" "INFO"
        }
    }

    # Heartbeat a cada 5 minutos
    if (((Get-Date) - $Script:LastHeartbeat).TotalSeconds -ge 300) {
        if (Send-Heartbeat) {
            Write-Log "Heartbeat enviado" "INFO"
        }
    }

    Start-Sleep -Seconds $IntervalSeconds
}
