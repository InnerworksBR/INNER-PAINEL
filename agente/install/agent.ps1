# Inner Agent - Script de Monitoramento
# Versao: 1.0.0

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
    $logLine = "$timestamp [`] $Message"
    Write-Host $logLine
    Add-Content -Path $Script:LogFile -Value $logLine -ErrorAction SilentlyContinue
}

function Invoke-Enrollment {
    Write-Log "Iniciando enrollment no portal..."

    $body = @{
        activation_token = $ActivationToken
        agent_type = "endpoint"
        hostname = $env:COMPUTERNAME
        ip_address = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch "Loopback|Loopback Pseudo-Interface" } | Select-Object -First 1).IPAddress
        os_info = "Windows"
        version = $Script:Version
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri "$PortalUrl/api/agent/enroll" 
            -Method Post 
            -Headers @{ "Content-Type" = "application/json" } 
            -Body $body 
            -TimeoutSec 30

        if ($response.status -eq "success") {
            Write-Log "Enrollment realizado com sucesso!" "SUCCESS"
            return @{
                success = $true
                assetKey = $response.asset_key
                agentSecret = $response.agent_secret
                agentId = $response.agent_id
            }
        } else {
            Write-Log "Enrollment falhou: $($response.error)" "ERROR"
            return @{ success = $false; error = $response.error }
        }
    } catch {
        Write-Log "Erro ao conectar com portal: $_" "ERROR"
        return @{ success = $false; error = $_.Exception.Message }
    }
}

function Get-HostMetrics {
    try {
        $cpu = (Get-Counter '\\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue
        $os = Get-CimInstance Win32_OperatingSystem
        $totalMem = [math]::Round($os.TotalVisibleMemorySize / 1024)
        $freeMem = [math]::Round($os.FreePhysicalMemory / 1024)
        $usedMem = $totalMem - $freeMem
        $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
        $totalDisk = [math]::Round($disk.Size / 1GB, 2)
        $freeDisk = [math]::Round($disk.FreeSpace / 1GB, 2)
        $usedDisk = $totalDisk - $freeDisk

        return @{
            cpu_percent = [math]::Round($cpu, 2)
            memory_percent = [math]::Round(($usedMem / $totalMem) * 100, 2)
            memory_total_mb = $totalMem
            memory_used_mb = $usedMem
            disk_percent = [math]::Round(($usedDisk / $totalDisk) * 100, 2)
            disk_total_gb = $totalDisk
            disk_used_gb = $usedDisk
            uptime_seconds = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds
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

        return @(Get-VM | ForEach-Object {
            @{
                name = $_.VMName
                cpu_percent = if ($_.ProcessorUsage) { [math]::Round($_.ProcessorUsage, 2) } else { 0 }
                memory_percent = 0
                memory_total_mb = [math]::Round($_.MemoryStartup / 1MB)
                memory_used_mb = [math]::Round($_.MemoryAssigned / 1MB)
                status = $_.State.ToString()
            }
        })
    } catch {
        return @()
    }
}

function Send-Metrics {
    param($HostMetrics, $VMs)

    $body = @{
        asset_key = $Script:AssetKey
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = $HostMetrics
        virtual_machines = $VMs
        partial = (-not $HostMetrics)
    } | ConvertTo-Json -Depth 5

    try {
        Invoke-RestMethod -Uri "$PortalUrl/api/agent/metrics/v2" 
            -Method Post 
            -Headers @{
                "Content-Type" = "application/json"
                "x-agent-secret" = $Script:AgentSecret
            } 
            -Body $body 
            -TimeoutSec 30 | Out-Null

        return $true
    } catch {
        Write-Log "Erro ao enviar metricas: $_" "WARN"
        $Script:OfflineBuffer += @{ timestamp = Get-Date; host = $HostMetrics; vms = $VMs }
        if ($Script:OfflineBuffer.Count -gt 10) { $Script:OfflineBuffer = $Script:OfflineBuffer[-10..-1] }
        return $false
    }
}

function Send-Heartbeat {
    try {
        Invoke-RestMethod -Uri "$PortalUrl/api/agent/heartbeat" 
            -Method Post 
            -Headers @{
                "Content-Type" = "application/json"
                "x-agent-secret" = $Script:AgentSecret
            } 
            -Body (@{ asset_key = $Script:AssetKey; status = "online" } | ConvertTo-Json) 
            -TimeoutSec 15 | Out-Null

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

# Validar configuracao
if (-not $PortalUrl) {
    Write-Log "ERRO: URL do portal nao configurada" "ERROR"
    Write-Log "Edite o arquivo config.json ou passe -PortalUrl" "ERROR"
    exit 1
}

if (-not $ActivationToken) {
    Write-Log "ERRO: Token de ativacao nao configurado" "ERROR"
    Write-Log "Edite o arquivo config.json ou passe -ActivationToken" "ERROR"
    exit 1
}

# Variaveis globais
$Script:AssetKey = $null
$Script:AgentSecret = $null
$Script:OfflineBuffer = @()
$Script:LastHeartbeat = Get-Date

# Fazer enrollment se nao tiver credenciais
if (-not $Script:AssetKey) {
    $enrollment = Invoke-Enrollment
    if (-not $enrollment.success) {
        Write-Log "FALHA no enrollment. Agente continuara tentando..." "ERROR"
        Write-Log "Motivo: $($enrollment.error)" "ERROR"
    } else {
        $Script:AssetKey = $enrollment.assetKey
        $Script:AgentSecret = $enrollment.agentSecret

        # Salvar credenciais no config para uso futuro
        $newConfig = @{
            portalUrl = $PortalUrl
            token = $ActivationToken
            assetKey = $Script:AssetKey
            agentSecret = $Script:AgentSecret
            intervalSeconds = $IntervalSeconds
        }
        $newConfig | ConvertTo-Json | Out-File -FilePath $Script:ConfigFile -Encoding UTF8

        Write-Log "Asset Key: $($Script:AssetKey)" "SUCCESS"
    }
}

Write-Log "Iniciando loop de metricas (intervalo: ${IntervalSeconds}s)" "INFO"

# ============================================
# LOOP PRINCIPAL
# ============================================

while ($true) {
    # Verificar se tem credenciais
    if (-not $Script:AssetKey) {
        Write-Log "Tentando enrollment novamente..." "WARN"
        $enrollment = Invoke-Enrollment
        if ($enrollment.success) {
            $Script:AssetKey = $enrollment.assetKey
            $Script:AgentSecret = $enrollment.agentSecret
            Write-Log "Enrollment realizado com sucesso!" "SUCCESS"
        } else {
            Write-Log "Enrollment falhou. Aguardando s..." "WARN"
            Start-Sleep -Seconds $IntervalSeconds
            continue
        }
    }

    # Coletar metricas
    $metrics = Get-HostMetrics
    $vms = Get-VMs

    if ($metrics) {
        # Enviar metricas
        $sent = Send-Metrics -HostMetrics $metrics -VMs $vms
        if ($sent) {
            Write-Log "Metricas: CPU=$($metrics.cpu_percent)%, RAM=$($metrics.memory_percent)%, Disk=$($metrics.disk_percent)%" "INFO"
        }

        # Tentar enviar metricas em buffer
        foreach ($entry in $Script:OfflineBuffer) {
            if (Send-Metrics -HostMetrics $entry.host -VMs $entry.vms) {
                Write-Log "Metrica em buffer enviada com sucesso" "INFO"
                $Script:OfflineBuffer = $Script:OfflineBuffer | Where-Object { $_.timestamp -ne $entry.timestamp }
            }
        }
    } else {
        Write-Log "Nao foi possivel coletar metricas do host" "WARN"
    }

    # Enviar heartbeat a cada 5 minutos
    if (((Get-Date) - $Script:LastHeartbeat).TotalSeconds -ge 300) {
        if (Send-Heartbeat) {
            Write-Log "Heartbeat enviado" "INFO"
        }
    }

    Start-Sleep -Seconds $IntervalSeconds
}
