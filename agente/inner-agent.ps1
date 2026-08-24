#Requires -Version 5.1
<#
.SYNOPSIS
    INNER PAINEL - Agente de Monitoramento para Windows
.DESCRIPTION
    Coleta metricas de CPU, Memoria, Disco e VMs Hyper-V
    Envia dados para o portal INNER PAINEL via API REST
.NOTES
    Versao: 1.0.0
    Requer: PowerShell 5.1+, Privilegios de Administrador
    Compatibilidade: Windows Server 2016+, Windows 10+
#>

param(
    [Parameter(Mandatory=$true, HelpMessage="URL base do portal INNER PAINEL")]
    [ValidateNotNullOrEmpty()]
    [string]$PortalUrl,

    [Parameter(Mandatory=$true, HelpMessage="Asset Key do agente")]
    [ValidateNotNullOrEmpty()]
    [string]$AssetKey,

    [Parameter(Mandatory=$true, HelpMessage="Secret do agente para autenticacao")]
    [ValidateNotNullOrEmpty()]
    [string]$AgentSecret,

    [Parameter(Mandatory=$false, HelpMessage="Intervalo de coleta em segundos")]
    [ValidateRange(10, 3600)]
    [int]$IntervalSeconds = 60,

    [Parameter(Mandatory=$false, HelpMessage="Intervalo de heartbeat em segundos")]
    [ValidateRange(30, 3600)]
    [int]$HeartbeatIntervalSeconds = 300,

    [Parameter(Mandatory=$false, HelpMessage="Nivel de log: DEBUG, INFO, WARN, ERROR")]
    [ValidateSet("DEBUG", "INFO", "WARN", "ERROR")]
    [string]$LogLevel = "INFO",

    [Parameter(Mandatory=$false, HelpMessage="Caminho do arquivo de log")]
    [string]$LogFile = "$env:ProgramData\INNER_PAINEL\logs\agent.log",

    [Parameter(Mandatory=$false, HelpMessage="Modo debug verboso")]
    [switch]$VerboseMode
)

# ============================================================
# CONFIGURACAO GLOBAL
# ============================================================

$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

# Variaveis globais
$Script:OfflineBuffer = @()
$Script:MaxBufferSize = 10
$Script:LastHeartbeat = $null
$Script:AgentId = $null
$Script:IsRunning = $true
$Script:MetricsCounter = 0
$Script:RetryCount = 0
$Script:MaxRetries = 3
$Script:RetryBaseDelay = 2

# Constantes
$Script:ApiMetricsEndpoint = "/api/agent/metrics/v2"
$Script:ApiHeartbeatEndpoint = "/api/agent/heartbeat"
$Script:ApiRegisterEndpoint = "/api/agent/register"

# ============================================================
# FUNCOES DE LOG
# ============================================================

function Write-Log {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,

        [Parameter(Mandatory=$false)]
        [ValidateSet("DEBUG", "INFO", "WARN", "ERROR")]
        [string]$Level = "INFO"
    )

    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"

    $levelPriority = @{
        "DEBUG" = 0
        "INFO"  = 1
        "WARN"  = 2
        "ERROR" = 3
    }

    if ($levelPriority[$Level] -ge $levelPriority[$LogLevel]) {
        # Log para console
        switch ($Level) {
            "ERROR" { Write-Host $logEntry -ForegroundColor Red }
            "WARN"  { Write-Host $logEntry -ForegroundColor Yellow }
            "DEBUG" { if ($VerboseMode) { Write-Host $logEntry -ForegroundColor Gray } }
            default { Write-Host $logEntry }
        }

        # Log para arquivo
        try {
            $logDir = Split-Path $LogFile -Parent
            if (-not (Test-Path $logDir)) {
                New-Item -ItemType Directory -Path $logDir -Force | Out-Null
            }
            Add-Content -Path $LogFile -Value $logEntry -Encoding UTF8
        }
        catch {
            # Silencioso em caso de falha no log
        }
    }
}

# ============================================================
# FUNCAO: Registrar Agente no Portal
# ============================================================

function Register-Agent {
    Write-Log "Registrando agente no portal..." -Level "INFO"

    $body = @{
        asset_key = $AssetKey
        secret = $AgentSecret
        hostname = $env:COMPUTERNAME
        platform = "windows"
        platform_version = [System.Environment]::OSVersion.VersionString
        agent_version = "1.0.0"
        capabilities = @("host_metrics", "hyperv_metrics", "wmi")
    } | ConvertTo-Json -Depth 3

    try {
        $response = Invoke-RestMethod `
            -Uri "${PortalUrl}${Script:ApiRegisterEndpoint}" `
            -Method Post `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 30

        if ($response.agent_id) {
            $Script:AgentId = $response.agent_id
            Write-Log "Agente registrado com ID: $Script:AgentId" -Level "INFO"
            return $true
        }
    }
    catch {
        Write-Log "Falha ao registrar agente: $($_.Exception.Message)" -Level "WARN"
    }

    return $false
}

# ============================================================
# FUNCAO: Coleta Metricas do Host (CPU, RAM, Disco)
# ============================================================

function Get-HostMetrics {
    Write-Log "Coletando metricas do host..." -Level "DEBUG"

    $metrics = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        hostname = $env:COMPUTERNAME
        collection_type = "host"
        data = @{}
    }

    # --- CPU: Uso percentual via Get-Counter ---
    try {
        $cpuCounter = Get-Counter '\Processor(_Total)\% Processor Time' -SampleInterval 1 -MaxSamples 1
        $cpuUsage = [math]::Round($cpuCounter.CounterSamples[0].CookedValue, 2)

        $metrics.data.cpu = @{
            usage_percent = $cpuUsage
            core_count = (Get-CimInstance Win32_Processor).NumberOfCores
            logical_processor_count = (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
            max_speed_mhz = (Get-CimInstance Win32_Processor).MaxClockSpeed
        }

        Write-Log "CPU: ${cpuUsage}%" -Level "DEBUG"
    }
    catch {
        Write-Log "Falha ao coletar CPU: $($_.Exception.Message)" -Level "WARN"
        $metrics.data.cpu = $null
    }

    # --- MEMORIA: Total e disponivel via WMI ---
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $totalMemoryGB = [math]::Round($os.TotalVisibleMemorySize / 1MB, 2)
        $freeMemoryGB = [math]::Round($os.FreePhysicalMemory / 1MB, 2)
        $usedMemoryGB = [math]::Round($totalMemoryGB - $freeMemoryGB, 2)
        $usagePercent = [math]::Round(($usedMemoryGB / $totalMemoryGB) * 100, 2)

        $metrics.data.memory = @{
            total_gb = $totalMemoryGB
            used_gb = $usedMemoryGB
            free_gb = $freeMemoryGB
            usage_percent = $usagePercent
        }

        Write-Log "Memoria: ${usedMemoryGB}GB / ${totalMemoryGB}GB (${usagePercent}%)" -Level "DEBUG"
    }
    catch {
        Write-Log "Falha ao coletar memoria: $($_.Exception.Message)" -Level "WARN"
        $metrics.data.memory = $null
    }

    # --- DISCO: Espaco em disco via WMI ---
    try {
        $disks = Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3"
        $diskData = @()

        foreach ($disk in $disks) {
            $totalGB = [math]::Round($disk.Size / 1GB, 2)
            $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
            $usedGB = [math]::Round($totalGB - $freeGB, 2)
            $usagePercent = if ($totalGB -gt 0) { [math]::Round(($usedGB / $totalGB) * 100, 2) } else { 0 }

            $diskData += @{
                device_id = $disk.DeviceID
                volume_name = $disk.VolumeName
                total_gb = $totalGB
                used_gb = $usedGB
                free_gb = $freeGB
                usage_percent = $usagePercent
                file_system = $disk.FileSystem
            }
        }

        $metrics.data.disk = $diskData

        foreach ($d in $diskData) {
            Write-Log "Disco $($d.device_id): $($d.used_gb)GB / $($d.total_gb)GB ($($d.usage_percent)%)" -Level "DEBUG"
        }
    }
    catch {
        Write-Log "Falha ao coletar disco: $($_.Exception.Message)" -Level "WARN"
        $metrics.data.disk = @()
    }

    # --- UPTIME ---
    try {
        $os = Get-CimInstance Win32_OperatingSystem
        $uptime = (Get-Date) - $os.LastBootUpTime
        $metrics.data.system = @{
            uptime_seconds = [int]$uptime.TotalSeconds
            uptime_formatted = "$([int]$uptime.TotalDays)d $($uptime.Hours)h $($uptime.Minutes)m"
            os_name = $os.Caption
            os_version = $os.Version
        }
    }
    catch {
        $metrics.data.system = $null
    }

    return $metrics
}

# ============================================================
# FUNCAO: Coleta Metricas de VMs Hyper-V
# ============================================================

function Get-VirtualMachines {
    Write-Log "Verificando VMs Hyper-V..." -Level "DEBUG"

    $metrics = @{
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        hostname = $env:COMPUTERNAME
        collection_type = "hyperv"
        data = @{
            hyperv_available = $false
            is_hypervisor_present = $false
            virtual_machines = @()
        }
    }

    # Verificar se Hyper-V esta disponivel no sistema
    try {
        $hyperVFeature = Get-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All -ErrorAction SilentlyContinue
        if ($null -ne $hyperVFeature -and $hyperVFeature.State -eq "Enabled") {
            $metrics.data.hyperv_available = $true
            Write-Log "Hyper-V detectado como recurso instalado" -Level "DEBUG"
        }
    }
    catch {
        # Continue - modulo pode nao estar disponivel
    }

    # Verificar se ha Hypervisor presente
    try {
        $cpu = Get-CimInstance Win32_ComputerSystem
        if ($cpu.HypervisorPresent -eq $true) {
            $metrics.data.is_hypervisor_present = $true
            Write-Log "Hypervisor detectado no sistema" -Level "DEBUG"
        }
    }
    catch {
        # Continue
    }

    # Verificar modulo Hyper-V PowerShell
    $hyperVModuleAvailable = $false
    try {
        $null = Get-Command Get-VM -ErrorAction Stop
        $hyperVModuleAvailable = $true
        Write-Log "Modulo Hyper-V PowerShell disponivel" -Level "DEBUG"
    }
    catch {
        Write-Log "Modulo Hyper-V PowerShell nao disponivel" -Level "DEBUG"
    }

    if (-not $hyperVModuleAvailable) {
        Write-Log "Modulo Hyper-V nao encontrado. Instale com: Install-WindowsFeature Hyper-V-PowerShell" -Level "WARN"
        return $metrics
    }

    # Coletar VMs
    try {
        $vms = Get-VM

        if ($vms) {
            Write-Log "Encontradas $($vms.Count) maquinas virtuais" -Level "DEBUG"

            foreach ($vm in $vms) {
                $vmMetrics = @{
                    name = $vm.VMName
                    id = $vm.VMId.Guid
                    state = $vm.State.ToString()
                    generation = $vm.Generation
                    creation_time = $vm.CreationTime.ToString("o")
                }

                # CPU
                try {
                    $cpuInfo = Get-VMProcessor -VMName $vm.VMName
                    $vmMetrics.cpu = @{
                        count = $cpuInfo.Count
                        usage_percent = 0  # Sera preenchido via contador se disponivel
                        dynamic_assignment_enabled = $cpuInfo.DynamicMemoryAssignment
                    }
                }
                catch {
                    $vmMetrics.cpu = @{ count = 0; usage_percent = 0 }
                }

                # Memoria
                try {
                    $memInfo = Get-VMMemory -VMName $vm.VMName
                    $vmMetrics.memory = @{
                        assigned_gb = [math]::Round($memInfo.Assigned / 1GB, 2)
                        startup_gb = [math]::Round($memInfo.Startup / 1GB, 2)
                        minimum_gb = if ($memInfo.Minimum -gt 0) { [math]::Round($memInfo.Minimum / 1GB, 2) } else { 0 }
                        maximum_gb = if ($memInfo.Maximum -gt 0) { [math]::Round($memInfo.Maximum / 1GB, 2) } else { 0 }
                        dynamic_memory = $memInfo.DynamicMemoryEnabled
                    }
                }
                catch {
                    $vmMetrics.memory = @{ assigned_gb = 0; startup_gb = 0 }
                }

                # Armazenamento
                try {
                    $disks = Get-VMHardDiskDrive -VMName $vm.VMName
                    $vmDisks = @()
                    foreach ($disk in $disks) {
                        $diskInfo = @{
                            controller_type = $disk.ControllerType.ToString()
                            controller_number = $disk.ControllerNumber
                            path = $disk.Path
                        }

                        # Tentar obter tamanho
                        if (Test-Path $disk.Path) {
                            $diskInfo.size_gb = [math]::Round((Get-Item $disk.Path).Length / 1GB, 2)
                        }

                        $vmDisks += $diskInfo
                    }
                    $vmMetrics.storage = $vmDisks
                }
                catch {
                    $vmMetrics.storage = @()
                }

                # Rede
                try {
                    $nics = Get-VMNetworkAdapter -VMName $vm.VMName
                    $vmNics = @()
                    foreach ($nic in $nics) {
                        $vmNics += @{
                            name = $nic.Name
                            switch_name = $nic.SwitchName
                            mac_address = $nic.MacAddress
                            ip_addresses = @()
                        }
                    }
                    $vmMetrics.network = $vmNics
                }
                catch {
                    $vmMetrics.network = @()
                }

                # Uptime
                if ($vm.Uptime -ne $null) {
                    $vmMetrics.uptime_seconds = [int]$vm.Uptime.TotalSeconds
                }

                $metrics.data.virtual_machines += $vmMetrics

                Write-Log "VM: $($vm.VMName) - $($vm.State)" -Level "DEBUG"
            }
        }
        else {
            Write-Log "Nenhuma VM encontrada neste host Hyper-V" -Level "DEBUG"
        }
    }
    catch {
        Write-Log "Falha ao coletar VMs: $($_.Exception.Message)" -Level "WARN"
    }

    return $metrics
}

# ============================================================
# FUNCAO: Enviar Metricas para o Portal
# ============================================================

function Send-Metrics {
    param(
        [Parameter(Mandatory=$true)]
        $Metrics,

        [Parameter(Mandatory=$false)]
        [switch]$FromBuffer
    )

    $idempotencyKey = [guid]::NewGuid().ToString()
    $endpoint = "${PortalUrl}${Script:ApiMetricsEndpoint}"

    $body = @{
        agent_id = $Script:AgentId
        asset_key = $AssetKey
        idempotency_key = $idempotencyKey
        metrics = @($Metrics)
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
    }

    if ($FromBuffer) {
        $body.from_buffer = $true
        $body.buffer_count = $Script:OfflineBuffer.Count
    }

    $bodyJson = $body | ConvertTo-Json -Depth 5 -Compress

    Write-Log "Enviando metricas (idempotency_key: $idempotencyKey)..." -Level "DEBUG"

    try {
        $response = Invoke-RestMethod `
            -Uri $endpoint `
            -Method Post `
            -Body $bodyJson `
            -ContentType "application/json" `
            -TimeoutSec 30

        if ($response.success -or $response.status -eq "ok") {
            Write-Log "Metricas enviadas com sucesso" -Level "DEBUG"
            $Script:RetryCount = 0
            return $true
        }
        else {
            Write-Log "Falha ao enviar metricas: $($response.message)" -Level "WARN"
            return $false
        }
    }
    catch {
        Write-Log "Erro ao enviar metricas: $($_.Exception.Message)" -Level "ERROR"

        # Adicionar ao buffer offline
        if ($Script:OfflineBuffer.Count -lt $Script:MaxBufferSize) {
            Write-Log "Adicionando metricas ao buffer offline (buffer: $($Script:OfflineBuffer.Count + 1)/$Script:MaxBufferSize)" -Level "WARN"
            $Script:OfflineBuffer += @{
                metrics = $Metrics
                timestamp = Get-Date
                idempotency_key = $idempotencyKey
            }
        }
        else {
            Write-Log "Buffer offline cheio. Metricas descartadas." -Level "ERROR"
        }

        return $false
    }
}

# ============================================================
# FUNCAO: Enviar Heartbeat
# ============================================================

function Send-Heartbeat {
    Write-Log "Enviando heartbeat..." -Level "DEBUG"

    $endpoint = "${PortalUrl}${Script:ApiHeartbeatEndpoint}"

    $body = @{
        agent_id = $Script:AgentId
        asset_key = $AssetKey
        hostname = $env:COMPUTERNAME
        timestamp = (Get-Date).ToUniversalTime().ToString("o")
        status = "online"
        version = "1.0.0"
        buffer_size = $Script:OfflineBuffer.Count
        metrics_sent = $Script:MetricsCounter
    }

    try {
        $response = Invoke-RestMethod `
            -Uri $endpoint `
            -Method Post `
            -Body ($body | ConvertTo-Json -Compress) `
            -ContentType "application/json" `
            -TimeoutSec 15

        if ($response.success -or $response.status -eq "ok") {
            $Script:LastHeartbeat = Get-Date
            Write-Log "Heartbeat OK - Proximo em ${HeartbeatIntervalSeconds}s" -Level "DEBUG"

            # Tentar enviar buffer offline
            if ($Script:OfflineBuffer.Count -gt 0) {
                Write-Log "Tentando enviar $($Script:OfflineBuffer.Count) metricas em buffer..." -Level "INFO"
                Send-OfflineBuffer
            }

            return $true
        }
        else {
            Write-Log "Heartbeat rejeitado: $($response.message)" -Level "WARN"
            return $false
        }
    }
    catch {
        Write-Log "Erro no heartbeat: $($_.Exception.Message)" -Level "WARN"
        return $false
    }
}

# ============================================================
# FUNCAO: Enviar Buffer Offline
# ============================================================

function Send-OfflineBuffer {
    $sentCount = 0
    $failedItems = @()

    foreach ($item in $Script:OfflineBuffer) {
        if (Send-Metrics -Metrics $item.metrics) {
            $sentCount++
        }
        else {
            $failedItems += $item
        }
    }

    $Script:OfflineBuffer = $failedItems

    if ($sentCount -gt 0) {
        Write-Log "Enviadas $sentCount metricas do buffer" -Level "INFO"
    }
}

# ============================================================
# FUNCAO: Calcular Backoff com Jitter
# ============================================================

function Get-BackoffDelay {
    param(
        [int]$RetryCount
    )

    $baseDelay = $Script:RetryBaseDelay
    $maxDelay = 60
    $exponentialDelay = [math]::Min($baseDelay * [math]::Pow(2, $RetryCount), $maxDelay)
    $jitter = Get-Random -Minimum 0 -Maximum ($exponentialDelay * 0.3)

    return [int]($exponentialDelay + $jitter)
}

# ============================================================
# FUNCAO: Trap para sinais de interrupcao
# ============================================================

function Stop-AgentGracefully {
    Write-Log "Sinal de parada recebido. Finalizando..." -Level "INFO"

    $Script:IsRunning = $false

    # Enviar metricas restantes em buffer
    if ($Script:OfflineBuffer.Count -gt 0) {
        Write-Log "Enviando metricas restantes do buffer..." -Level "INFO"
        Send-OfflineBuffer
    }

    # Enviar heartbeat final
    try {
        $body = @{
            agent_id = $Script:AgentId
            asset_key = $AssetKey
            hostname = $env:COMPUTERNAME
            timestamp = (Get-Date).ToUniversalTime().ToString("o")
            status = "offline"
            version = "1.0.0"
        } | ConvertTo-Json

        Invoke-RestMethod `
            -Uri "${PortalUrl}${Script:ApiHeartbeatEndpoint}" `
            -Method Post `
            -Body $body `
            -ContentType "application/json" `
            -TimeoutSec 10
    }
    catch {
        Write-Log "Falha ao enviar status offline: $($_.Exception.Message)" -Level "WARN"
    }

    Write-Log "Agente finalizado." -Level "INFO"
    exit 0
}

# Registrar handlers
$null = [Console]::TreatControlCAsInput, $true
$script:CtrlCHandler = {
    if ($Host.UI.RawUI.KeyAvailable) {
        $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        if (($key.Modifiers -eq [System.Management.Automation.Host.ReadKeyOptions]::Control) -and ($key.VirtualKeyCode -eq 67)) {
            Stop-AgentGracefully
        }
    }
}

# Trap para parada graciosa
trap { Stop-AgentGracefully }

# ============================================================
# VALIDACOES INICIAIS
# ============================================================

Write-Log "=== INNER PAINEL Agent v1.0.0 ===" -Level "INFO"
Write-Log "Portal: $PortalUrl" -Level "INFO"
Write-Log "Asset Key: $AssetKey" -Level "INFO"
Write-Log "Intervalo de coleta: ${IntervalSeconds}s" -Level "INFO"
Write-Log "Intervalo de heartbeat: ${HeartbeatIntervalSeconds}s" -Level "INFO"

# Verificar se e admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Log "AVISO: Execucao sem privilegios de administrador. Algumas metricas podem estar indisponiveis." -Level "WARN"
}

# Validar URL
if (-not $PortalUrl.StartsWith("http://") -and -not $PortalUrl.StartsWith("https://")) {
    $PortalUrl = "http://$PortalUrl"
}

# Garantir que URL termina sem /
if ($PortalUrl.EndsWith("/")) {
    $PortalUrl = $PortalUrl.TrimEnd("/")
}

Write-Log "URL final: $PortalUrl" -Level "DEBUG"

# ============================================================
# REGISTRO DO AGENTE
# ============================================================

$registered = Register-Agent

if (-not $registered) {
    Write-Log "Nao foi possivel registrar agente. Tentando continuar sem registro..." -Level "WARN"
    $Script:AgentId = "unregistered-$env:COMPUTERNAME"
}

# ============================================================
# LOOP PRINCIPAL
# ============================================================

Write-Log "Iniciando loop principal..." -Level "INFO"

$nextHeartbeat = (Get-Date).AddSeconds($HeartbeatIntervalSeconds)

while ($Script:IsRunning) {
    try {
        # Processar Ctrl+C
        if ($Host.UI.RawUI.KeyAvailable) {
            $key = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
            if (($key.Modifiers -eq [System.Management.Automation.Host.ReadKeyOptions]::Control) -and ($key.VirtualKeyCode -eq 67)) {
                Stop-AgentGracefully
            }
        }

        # Coletar metricas do host
        $hostMetrics = Get-HostMetrics

        # Coletar VMs
        $vmMetrics = Get-VirtualMachines

        # Enviar metricas do host
        if (Send-Metrics -Metrics $hostMetrics) {
            $Script:MetricsCounter++
        }

        # Enviar metricas de VMs (se houver)
        if ($vmMetrics.data.virtual_machines.Count -gt 0) {
            Start-Sleep -Milliseconds 500  # Pequeno delay entre requests
            if (Send-Metrics -Metrics $vmMetrics) {
                $Script:MetricsCounter++
            }
        }

        # Verificar heartbeat
        if ((Get-Date) -ge $nextHeartbeat) {
            $heartbeatOk = Send-Heartbeat
            $nextHeartbeat = (Get-Date).AddSeconds($HeartbeatIntervalSeconds)
        }

        # Aguardar proximo ciclo
        Start-Sleep -Seconds $IntervalSeconds

    }
    catch {
        Write-Log "Erro no loop principal: $($_.Exception.Message)" -Level "ERROR"

        if ($Script:RetryCount -lt $Script:MaxRetries) {
            $backoffDelay = Get-BackoffDelay -RetryCount $Script:RetryCount
            Write-Log "Aguardando ${backoffDelay}s antes de tentar novamente (tentativa $($Script:RetryCount + 1)/$Script:MaxRetries)..." -Level "WARN"
            $Script:RetryCount++
            Start-Sleep -Seconds $backoffDelay
        }
        else {
            Write-Log "Maximo de tentativas alcancado. Aguardando intervalo normal..." -Level "ERROR"
            $Script:RetryCount = 0
        }
    }
}

Stop-AgentGracefully
