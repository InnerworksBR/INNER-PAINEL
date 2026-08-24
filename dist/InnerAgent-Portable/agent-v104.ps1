# Inner Agent v1.0.4
# CORRIGIDO - NAO TENTA ENROLLMENT SE JA TEM CREDENCIAIS

param(
    [string]$PortalUrl = "",
    [string]$ActivationToken = "",
    [int]$IntervalSeconds = 60
)

$ErrorActionPreference = "Continue"
$Script:Version = "1.0.4"
$Script:ConfigFile = "$PSScriptRoot\config.json"
$Script:LogFile = "$PSScriptRoot\agent.log"

# Variaveis globais para credenciais
$global:AssetKey = $null
$global:AgentSecret = $null

# Carregar config
if (Test-Path $Script:ConfigFile) {
    $json = Get-Content $Script:ConfigFile -Raw
    $config = $json | ConvertFrom-Json
    if (-not $PortalUrl -and $config.portalUrl) { $PortalUrl = $config.portalUrl }
    if (-not $ActivationToken -and $config.token) { $ActivationToken = $config.token }
    if ($config.assetKey) { $global:AssetKey = $config.assetKey }
    if ($config.agentSecret) { $global:AgentSecret = $config.agentSecret }
    if ($config.intervalSeconds) { $IntervalSeconds = $config.intervalSeconds }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp [$Level] $Message"
    Add-Content -Path $Script:LogFile -Value "$timestamp [$Level] $Message" -ErrorAction SilentlyContinue
}

# ENROLLMENT - apenas se NAO tem credenciais
function Do-Enrollment {
    if ($global:AssetKey -and $global:AgentSecret) {
        Write-Log "Ja tem credenciais, pulando enrollment" "INFO"
        return $true
    }

    Write-Log "Fazendo enrollment..." "INFO"

    $body = @{
        activation_token = $ActivationToken
        agent_type = "endpoint"
        hostname = $env:COMPUTERNAME
        ip_address = "unknown"
        os_info = "Windows"
        version = $Script:Version
    }

    try {
        $resp = Invoke-RestMethod -Uri "$PortalUrl/api/agent/enroll" -Method Post -ContentType "application/json" -Body ($body | ConvertTo-Json) -TimeoutSec 30

        if ($resp.status -eq "success") {
            $global:AssetKey = $resp.asset_key
            $global:AgentSecret = $resp.agent_secret

            # Salvar no config
            $newConfig = @{
                portalUrl = $PortalUrl
                token = $ActivationToken
                assetKey = $global:AssetKey
                agentSecret = $global:AgentSecret
                intervalSeconds = $IntervalSeconds
            }
            $newConfig | ConvertTo-Json | Out-File -FilePath $Script:ConfigFile -Encoding UTF8

            Write-Log "Enrollment OK - Asset: $($global:AssetKey)" "SUCCESS"
            return $true
        }
    } catch {
        Write-Log "Enrollment falhou: $_" "ERROR"
    }

    return $false
}

# COLETAR METRICAS
function Get-Metrics {
    $result = @{
        cpu_percent = 0
        memory_percent = 0
        memory_total_mb = 0
        memory_used_mb = 0
        disk_percent = 0
        disk_total_gb = 0
        disk_used_gb = 0
        uptime_seconds = 0
    }

    try {
        # CPU via WMI (mais confiavel que Get-Counter)
        try {
            $proc = Get-CimInstance Win32_Processor
            if ($proc -and $proc.LoadPercentage) {
                $result.cpu_percent = [math]::Round($proc.LoadPercentage, 2)
            }
        } catch {}

        # Memoria
        try {
            $os = Get-CimInstance Win32_OperatingSystem
            $total = [math]::Round($os.TotalVisibleMemorySize / 1024)
            $free = [math]::Round($os.FreePhysicalMemory / 1024)
            $used = $total - $free
            $result.memory_total_mb = $total
            $result.memory_used_mb = $used
            if ($total -gt 0) {
                $result.memory_percent = [math]::Round(($used / $total) * 100, 2)
            }
            $result.uptime_seconds = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds
        } catch {}

        # Disco
        try {
            $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
            if ($disk) {
                $total = [math]::Round($disk.Size / 1GB, 2)
                $free = [math]::Round($disk.FreeSpace / 1GB, 2)
                $used = $total - $free
                $result.disk_total_gb = $total
                $result.disk_used_gb = $used
                if ($total -gt 0) {
                    $result.disk_percent = [math]::Round(($used / $total) * 100, 2)
                }
            }
        } catch {}
    } catch {
        Write-Log "Erro coleta metricas: $_" "WARN"
    }

    return $result
}

# ENVIAR METRICAS
function Send-Metrics {
    param($Metrics)

    if (-not $global:AssetKey -or -not $global:AgentSecret) {
        return $false
    }

    $body = @{
        asset_key = $global:AssetKey
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = $Metrics
        virtual_machines = @()
        partial = $false
    }

    try {
        Invoke-RestMethod -Uri "$PortalUrl/api/agent/metrics/v2" -Method Post -ContentType "application/json" -Headers @{"x-agent-secret" = $global:AgentSecret} -Body ($body | ConvertTo-Json -Depth 5) -TimeoutSec 30 | Out-Null
        return $true
    } catch {
        Write-Log "Erro enviar metricas: $_" "WARN"
        return $false
    }
}

# ============================================
# MAIN
# ============================================

Write-Log "========================================" "INFO"
Write-Log "Inner Agent v$Script:Version" "INFO"
Write-Log "========================================" "INFO"

if (-not $PortalUrl) {
    Write-Log "ERRO: Configure portalUrl no config.json" "ERROR"
    exit 1
}

if (-not $ActivationToken -and -not $global:AssetKey) {
    Write-Log "ERRO: Configure token ou assetKey no config.json" "ERROR"
    exit 1
}

# Tentar enrollment apenas uma vez
Do-Enrollment

Write-Log "Loop iniciado - Intervalo: ${IntervalSeconds}s" "INFO"

# Loop principal
while ($true) {
    # Coleta e envia metricas
    $m = Get-Metrics
    $ok = Send-Metrics -Metrics $m

    if ($ok) {
        Write-Log "OK CPU=$($m.cpu_percent)% RAM=$($m.memory_percent)% Disk=$($m.disk_percent)%" "INFO"
    }

    # So tenta enrollment de novo se NAO tem credenciais
    if (-not $global:AssetKey) {
        Write-Log "Sem credenciais, tentando enrollment..." "WARN"
        Do-Enrollment
    }

    Start-Sleep -Seconds $IntervalSeconds
}
