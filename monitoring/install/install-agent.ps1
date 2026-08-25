# Inner Monitoring Agent - Installation Script
# Requires: PowerShell 5.1+, .NET 8 Runtime

param(
    [Parameter(ParameterSetName = "Install")]
    [switch]$Install,

    [Parameter(ParameterSetName = "Uninstall")]
    [switch]$Uninstall,

    [Parameter(ParameterSetName = "Install")]
    [string]$ActivationToken = "",

    [Parameter(ParameterSetName = "Install")]
    [string]$ApiBaseUrl = "https://innerworks-painelcloudapi.zvzr4n.easypanel.host",

    [switch]$Force
)

$ErrorActionPreference = "Stop"

$ServiceName = "Inner Monitoring Agent"
$ServiceDisplayName = "Inner Monitoring Agent"
$ProgramFilesPath = "$env:ProgramFiles\InnerWorks\MonitoringAgent"
$ProgramDataPath = "$env:ProgramData\InnerWorks\MonitoringAgent"
$InstallerDirectory = $PSScriptRoot

function Write-Banner {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  Inner Monitoring Agent Installer" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
}

function Test-Admin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function New-Directories {
    param([switch]$Force)

    $dirs = @(
        $ProgramFilesPath,
        "$ProgramDataPath\config",
        "$ProgramDataPath\data\secrets",
        "$ProgramDataPath\logs"
    )

    foreach ($dir in $dirs) {
        if ((Test-Path $dir) -and -not $Force) {
            Write-Host "  [SKIP] $dir already exists" -ForegroundColor Yellow
        } else {
            New-Item -ItemType Directory -Path $dir -Force | Out-Null
            Write-Host "  [CREATED] $dir" -ForegroundColor Green
        }
    }
}

function Stop-InstalledAgent {
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $existing) {
        return
    }

    if ($existing.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Write-Host "  Stopping existing service before updating files..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force
        $existing.WaitForStatus(
            [System.ServiceProcess.ServiceControllerStatus]::Stopped,
            [TimeSpan]::FromSeconds(20))
        Start-Sleep -Seconds 1
        Write-Host "  [STOPPED] Existing service" -ForegroundColor Green
    }
}

function Copy-Files {
    $srcDir = $InstallerDirectory
    if ([string]::IsNullOrWhiteSpace($srcDir) -or -not (Test-Path -LiteralPath $srcDir)) {
        throw "Não foi possível localizar a pasta do instalador. Execute o script a partir do pacote publicado do agente."
    }

    $exeFiles = Get-ChildItem -Path $srcDir -Filter "Inner.Monitoring.Agent.Windows.exe" -File -ErrorAction SilentlyContinue

    if ($exeFiles.Count -eq 0) {
        throw "No executable found in $srcDir. Build the project first."
    }

    $latestExe = $exeFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    $destExe = Join-Path $ProgramFilesPath $latestExe.Name

    Write-Host "  Copying $($latestExe.Name) to $ProgramFilesPath..." -ForegroundColor Gray
    Copy-Item $latestExe.FullName $destExe -Force

    return $destExe
}

function Save-ActivationToken {
    param([string]$Token)

    if ([string]::IsNullOrWhiteSpace($Token)) {
        throw "Informe o token de ativação gerado no Portal."
    }

    $tokenPath = "$ProgramDataPath\data\secrets\activation.token"
    Set-Content -Path $tokenPath -Value $Token.Trim() -Encoding UTF8 -NoNewline
    Write-Host "  [CREATED] activation.token" -ForegroundColor Green
}

function New-BootstrapConfig {
    param([string]$ApiUrl)

    if ($ApiUrl -match '[\[\]\(\)]' -or -not [Uri]::IsWellFormedUriString($ApiUrl, [UriKind]::Absolute)) {
        throw "ApiBaseUrl inválida. Informe somente a URL, por exemplo: https://innerworks-painelcloudapi.zvzr4n.easypanel.host"
    }

    $bootstrapPath = "$ProgramDataPath\config\bootstrap.json"

    if (Test-Path $bootstrapPath) {
        if (-not $Force) {
            Write-Host "  [SKIP] bootstrap.json already exists. Use -Force to overwrite." -ForegroundColor Yellow
            return
        }
    }

    $config = @{
        api_base_url = $ApiUrl.TrimEnd('/')
        heartbeat_interval_seconds = 60
        collection_interval_seconds = 15
        log_level = "Information"
    }

    $config | ConvertTo-Json -Depth 10 | Set-Content $bootstrapPath -Encoding UTF8
    Write-Host "  [CREATED] bootstrap.json" -ForegroundColor Green
}

function Register-Service {
    param([string]$ExePath)

    $scPath = "sc.exe"

    # Stop existing service if running
    $existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($existing) {
        Write-Host "  Stopping existing service..." -ForegroundColor Yellow
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }

    # Delete existing service
    $deleteResult = & $scPath delete $ServiceName 2>&1
    if ($LASTEXITCODE -eq 0 -or $deleteResult -match "marked for deletion") {
        Write-Host "  [REMOVED] Existing service" -ForegroundColor Green
        Start-Sleep -Seconds 2
    }

    # Create new service
    Write-Host "  Creating Windows service..." -ForegroundColor Gray
    $createResult = & $scPath create $ServiceName binPath= "`"$ExePath`"" start= auto DisplayName= "$ServiceDisplayName" 2>&1

    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create service: $createResult"
    }

    Write-Host "  [CREATED] Windows service" -ForegroundColor Green

    # Configure recovery actions
    Write-Host "  Configuring recovery actions..." -ForegroundColor Gray
    & $scPath failure $ServiceName reset= 86400 actions= "restart/60000/restart/60000/restart/60000" | Out-Null
    Write-Host "  [CONFIGURED] Recovery actions" -ForegroundColor Green
}

function Install-Agent {
    Write-Banner

    if (-not (Test-Admin)) {
        Write-Host "ERROR: Administrator privileges required." -ForegroundColor Red
        Write-Host "Please run PowerShell as Administrator and try again." -ForegroundColor Yellow
        return 1
    }

    Write-Host "Installing $ServiceDisplayName..." -ForegroundColor White
    Write-Host ""

    # Create directories
    Write-Host "[1/4] Creating directories..." -ForegroundColor Cyan
    New-Directories -Force:$Force

    # Stop the service before replacing its executable. Windows locks a running
    # service binary and Copy-Item cannot overwrite it while the process is active.
    Stop-InstalledAgent

    # Copy files
    Write-Host ""
    Write-Host "[2/4] Copying files..." -ForegroundColor Cyan
    $exePath = Copy-Files

    # Create bootstrap config
    Write-Host ""
    Write-Host "[3/4] Creating bootstrap configuration..." -ForegroundColor Cyan
    New-BootstrapConfig -ApiUrl $ApiBaseUrl

    if (-not [string]::IsNullOrWhiteSpace($ActivationToken)) {
        Save-ActivationToken -Token $ActivationToken
    }

    # Register service
    Write-Host ""
    Write-Host "[4/4] Registering Windows service..." -ForegroundColor Cyan
    Register-Service -ExePath $exePath

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "  1. Start the service: sc start `"$ServiceName`"" -ForegroundColor Yellow
    Write-Host "  2. Check status: Get-Service `"$ServiceName`"" -ForegroundColor Yellow
    Write-Host "  3. View logs: Get-Content `"$ProgramDataPath\logs\agent-$(Get-Date -Format 'yyyyMMdd').log`" -Tail 50 -Wait" -ForegroundColor Yellow
    Write-Host ""

    if (-not [string]::IsNullOrEmpty($ActivationToken)) {
        Write-Host "Activation token provided. Starting service..." -ForegroundColor Cyan
        Start-Service -Name $ServiceName
        Write-Host "Service started successfully." -ForegroundColor Green
    }

    return 0
}

function Uninstall-Agent {
    Write-Banner

    if (-not (Test-Admin)) {
        Write-Host "ERROR: Administrator privileges required." -ForegroundColor Red
        return 1
    }

    Write-Host "Uninstalling $ServiceDisplayName..." -ForegroundColor White
    Write-Host ""

    # Stop service
    Write-Host "[1/3] Stopping service..." -ForegroundColor Cyan
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Write-Host "  [STOPPED] Service stopped" -ForegroundColor Green

    # Delete service
    Write-Host ""
    Write-Host "[2/3] Removing Windows service..." -ForegroundColor Cyan
    $scPath = "sc.exe"
    $deleteResult = & $scPath delete $ServiceName 2>&1

    if ($LASTEXITCODE -eq 0 -or $deleteResult -match "marked for deletion") {
        Write-Host "  [REMOVED] Windows service" -ForegroundColor Green
    } else {
        Write-Host "  [SKIP] Service not found" -ForegroundColor Yellow
    }

    # Ask about data removal
    Write-Host ""
    Write-Host "[3/3] Data removal:" -ForegroundColor Cyan
    $removeData = Read-Host "Remove all agent data (config, database, logs)? [y/N]"

    if ($removeData -eq "y" -or $removeData -eq "Y") {
        Write-Host "  Removing data from $ProgramDataPath..." -ForegroundColor Gray
        Remove-Item -Path "$ProgramDataPath" -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  [REMOVED] Agent data" -ForegroundColor Green
    } else {
        Write-Host "  [KEPT] Agent data preserved" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Uninstallation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""

    return 0
}

# Main
try {
    if ($Uninstall) {
        exit [int](Uninstall-Agent)
    }
    elseif ($Install) {
        exit [int](Install-Agent)
    }
    else {
        Write-Banner
        Write-Host "Usage:" -ForegroundColor White
        Write-Host "  .\install-agent.ps1 -Install [-ActivationToken <token>] [-ApiBaseUrl <url>]" -ForegroundColor Yellow
        Write-Host "  .\install-agent.ps1 -Uninstall" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Examples:" -ForegroundColor White
        Write-Host "  .\install-agent.ps1 -Install" -ForegroundColor Gray
        Write-Host "  .\install-agent.ps1 -Install -ActivationToken `"abc123`" -ApiBaseUrl `"https://api.example.com`"" -ForegroundColor Gray
        Write-Host "  .\install-agent.ps1 -Uninstall" -ForegroundColor Gray
        Write-Host ""
        exit 0
    }
}
catch {
    Write-Host ""
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host $_.ScriptStackTrace -ForegroundColor DarkGray
    exit 1
}
