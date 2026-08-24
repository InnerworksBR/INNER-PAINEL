# Inner Agent - Instalador Automático
# Versão: 1.0.0
# Requer: Windows Server 2016+, PowerShell 5.1+, Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$PortalUrl,

    [Parameter(Mandatory=$true)]
    [string]$ActivationToken,

    [string]$InstallPath = "$env:ProgramFiles\InnerAgent",

    [int]$IntervalSeconds = 60
)

$ErrorActionPreference = "Stop"
$Script:Version = "1.0.0"

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
    Write-InstallLog "Solicitando registro ao portal..."

    try {
        $headers = @{
            "Content-Type" = "application/json"
        }

        $body = @{
            activation_token = $ActivationToken
            agent_type = "endpoint"
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

function Install-AgentService {
    param(
        [string]$AssetKey,
        [string]$AgentSecret
    )

    Write-InstallLog "Instalando como serviço Windows..."

    # Criar diretório
    if (-not (Test-Path $InstallPath)) {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
    }

    # Copiar script do agente
    $agentScript = @"
param(
    `$PortalUrl = "$PortalUrl",
    `$AssetKey = "$AssetKey",
    `$AgentSecret = "$AgentSecret",
    `$IntervalSeconds = $IntervalSeconds
)

`$ErrorActionPreference = "SilentlyContinue"
`$Script:HostName = `$env:COMPUTERNAME
`$Script:LastHeartbeat = Get-Date
`$Script:OfflineBuffer = @()

function Write-Log {
  param([string]`$Message, [string]`$Level = "INFO")
  `$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host "`$timestamp [``$Level] ``$Message"
}

function Get-HostMetrics {
  try {
    `$cpuCounter = Get-Counter '\\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue
    `$cpuPercent = [math]::Round(`$cpuCounter.CounterSamples[0].CookedValue, 2)

    `$os = Get-CimInstance Win32_OperatingSystem
    `$totalMemMB = [math]::Round(`$os.TotalVisibleMemorySize / 1024)
    `$freeMemMB = [math]::Round(`$os.FreePhysicalMemory / 1024)
    `$usedMemMB = `$totalMemMB - `$freeMemMB
    `$memPercent = [math]::Round(((`$usedMemMB / `$totalMemMB) * 100), 2)

    `$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    `$totalDiskGB = [math]::Round(`$disk.Size / 1GB, 2)
    `$freeDiskGB = [math]::Round(`$disk.FreeSpace / 1GB, 2)
    `$usedDiskGB = [math]::Round(`$totalDiskGB - `$freeDiskGB, 2)
    `$diskPercent = [math]::Round(((`$usedDiskGB / `$totalDiskGB) * 100), 2)

    `$uptime = (Get-Date) - `$os.LastBootUpTime

    return @{
      cpu_percent = `$cpuPercent
      memory_percent = `$memPercent
      memory_total_mb = `$totalMemMB
      memory_used_mb = `$usedMemMB
      disk_percent = `$diskPercent
      disk_total_gb = `$totalDiskGB
      disk_used_gb = `$usedDiskGB
      uptime_seconds = [int]`$uptime.TotalSeconds
    }
  } catch {
    return `$null
  }
}

function Get-VirtualMachines {
  try {
    `$hyperV = Get-Module -ListAvailable -Name Hyper-V -ErrorAction SilentlyContinue
    if (-not `$hyperV) { return @() }

    Import-Module Hyper-V -ErrorAction SilentlyContinue

    `$vms = Get-VM | ForEach-Object {
      @{
        name = `$_.VMName
        cpu_percent = if (`$_.ProcessorUsage) { [math]::Round(`$_.ProcessorUsage, 2) } else { 0 }
        memory_percent = 0
        memory_total_mb = [math]::Round(`$_.MemoryStartup / 1MB)
        memory_used_mb = [math]::Round(`$_.MemoryAssigned / 1MB)
        status = `$_.State.ToString()
      }
    }

    return @(`$vms)
  } catch {
    return @()
  }
}

function Send-Metrics {
  param(`$HostMetrics, `$VirtualMachines)

  `$idempotencyKey = [guid]::NewGuid().ToString()
  `$collectedAt = (Get-Date).ToUniversalTime().ToString("o")

  `$body = @{
    asset_key = `$AssetKey
    idempotency_key = `$idempotencyKey
    collected_at = `$collectedAt
    host = `$HostMetrics
    virtual_machines = `$VirtualMachines
    partial = (-not `$HostMetrics)
  } | ConvertTo-Json -Depth 5

  try {
    Invoke-RestMethod -Uri "`$PortalUrl/api/agent/metrics/v2" `
      -Method Post `
      -Headers @{
        "Content-Type" = "application/json"
        "x-agent-secret" = "`$AgentSecret"
      } `
      -Body `$body `
      -TimeoutSec 30 | Out-Null

    return `$true
  } catch {
    `$Script:OfflineBuffer += @{ timestamp = Get-Date; host = `$HostMetrics; vms = `$VirtualMachines }
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
        "x-agent-secret" = "`$AgentSecret"
      } `
      -Body (@{ asset_key = `$AssetKey; status = "online" } | ConvertTo-Json) `
      -TimeoutSec 15 | Out-Null

    `$Script:LastHeartbeat = Get-Date
    return `$true
  } catch {
    return `$false
  }
}

while (`$true) {
  `$metrics = Get-HostMetrics
  `$vms = Get-VirtualMachines

  if (`$metrics) {
    Send-Metrics -HostMetrics `$metrics -VirtualMachines `$vms

    foreach (`$entry in `$Script:OfflineBuffer) {
      if (Send-Metrics -HostMetrics `$entry.host -VirtualMachines `$entry.vms) {
        `$Script:OfflineBuffer = `$Script:OfflineBuffer | Where-Object { `$_.timestamp -ne `$entry.timestamp }
      }
    }
  }

  if (((Get-Date) - `$Script:LastHeartbeat).TotalSeconds -ge 300) {
    Send-Heartbeat
  }

  Start-Sleep -Seconds `$IntervalSeconds
}
"@

    # Salvar script
    $agentScriptPath = "$InstallPath\agent.ps1"
    $agentScript | Out-File -FilePath $agentScriptPath -Encoding UTF8
    Write-InstallLog "Script salvo em: $agentScriptPath"

    # Criar serviço usando sc.exe
    $serviceName = "InnerAgent"
    $displayName = "Inner Agent - Monitoramento"
    $description = "Agente de monitoramento descentralizado Inner"

    # Verificar se já existe
    $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
    if ($existingService) {
        Write-InstallLog "Serviço já existe. Removendo..." "WARN"
        Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $serviceName
        Start-Sleep -Seconds 2
    }

    # Criar serviço
    $exePath = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
    $args = "-ExecutionPolicy Bypass -NoLogo -NoProfile -WindowStyle Hidden -File `"$agentScriptPath`""

    sc.exe create $serviceName binPath= `"$exePath $args`" start= auto DisplayName= "$displayName" type= own
    sc.exe description $serviceName $description
    sc.exe config $serviceName obj= "NT AUTHORITY\LocalService"

    Write-InstallLog "Serviço criado: $serviceName"

    # Iniciar serviço
    Start-Service -Name $serviceName
    Write-InstallLog "Serviço iniciado!" "SUCCESS"

    # Salvar credenciais em arquivo config (para reinicialização)
    @{
        PortalUrl = $PortalUrl
        AssetKey = $AssetKey
        AgentSecret = $AgentSecret
        IntervalSeconds = $IntervalSeconds
        ServiceName = $serviceName
    } | ConvertTo-Json | Out-File -FilePath "$InstallPath\config.json" -Encoding UTF8

    # Criar uninstall.bat
    @"
@echo off
sc stop InnerAgent
sc delete InnerAgent
rmdir /s /q "%ProgramFiles%\InnerAgent"
echo Inner Agent removido com sucesso.
"@ | Out-File -FilePath "$InstallPath\uninstall.bat" -Encoding ASCII

    return $true
}

# ============================================
# INÍCIO DA INSTALAÇÃO
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner Agent - Instalador" -ForegroundColor Cyan
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
Write-InstallLog "Caminho: $InstallPath"

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

# Instalar serviço
Write-Host "Instalando serviço Windows..." -ForegroundColor Cyan
$installed = Install-AgentService -AssetKey $result.assetKey -AgentSecret $result.agentSecret

if ($installed) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  INSTALAÇÃO CONCLUÍDA!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "O Inner Agent está rodando como serviço." -ForegroundColor White
    Write-Host "Para verificar o status:" -ForegroundColor White
    Write-Host "  Get-Service InnerAgent" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Para desinstalar:" -ForegroundColor White
    Write-Host "  $InstallPath\uninstall.bat" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "FALHA ao instalar serviço." -ForegroundColor Red
    exit 1
}
