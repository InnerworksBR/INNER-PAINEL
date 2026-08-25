# Inner Monitoring Agent - Windows Service Installer
# Run as Administrator

param(
    [Parameter(Mandatory=$true)]
    [string]$ActivationToken,

    [Parameter(Mandatory=$false)]
    [string]$ApiBaseUrl = "https://api.innerworks.com.br",

    [Parameter(Mandatory=$false)]
    [int]$HeartbeatIntervalSeconds = 60,

    [Parameter(Mandatory=$false)]
    [int]$CollectionIntervalSeconds = 15
)

$ErrorActionPreference = "Stop"
$ServiceName = "InnerMonitoringAgent"
$DisplayName = "Inner Monitoring Agent"
$Description = "Inner Monitoring Agent - Windows Service for host metrics collection"
$InstallPath = "$env:ProgramFiles\InnerWorks\MonitoringAgent"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

Write-Log "Installing Inner Monitoring Agent..."
Write-Log "================================"

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Log "ERROR: This script must be run as Administrator"
    exit 1
}

# Create installation directory
Write-Log "Creating installation directory: $InstallPath"
New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null

# Copy files
$exePath = "$PSScriptRoot\Inner.Monitoring.Agent.Windows.exe"
if (Test-Path $exePath) {
    Write-Log "Copying application files..."
    Copy-Item "$exePath" "$InstallPath\" -Force
} else {
    Write-Log "WARNING: Executable not found at $exePath"
    Write-Log "Please build the project first or copy the executable manually"
}

# Create data directories
$programDataPath = "$env:ProgramData\InnerWorks\MonitoringAgent"
$configPath = Join-Path $programDataPath "config"
$dataPath = Join-Path $programDataPath "data"
$logsPath = Join-Path $programDataPath "logs"
$secretsPath = Join-Path $dataPath "secrets"

Write-Log "Creating data directories..."
New-Item -ItemType Directory -Force -Path $configPath | Out-Null
New-Item -ItemType Directory -Force -Path $dataPath | Out-Null
New-Item -ItemType Directory -Force -Path $logsPath | Out-Null
New-Item -ItemType Directory -Force -Path $secretsPath | Out-Null

# Create bootstrap configuration
Write-Log "Creating bootstrap configuration..."
$bootstrapConfig = @{
    api_base_url = $ApiBaseUrl
    heartbeat_interval_seconds = $HeartbeatIntervalSeconds
    collection_interval_seconds = $CollectionIntervalSeconds
} | ConvertTo-Json

Set-Content -Path (Join-Path $configPath "bootstrap.json") -Value $bootstrapConfig -Encoding UTF8

# Create activation token file
Write-Log "Storing activation token..."
$tokenPath = Join-Path $secretsPath "activation.token"
Set-Content -Path $tokenPath -Value $ActivationToken -Encoding UTF8

# Install as Windows Service
Write-Log "Registering Windows Service..."
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($existingService) {
    Write-Log "Service already exists, stopping and removing..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 2
}

$binPath = "`"$InstallPath\Inner.Monitoring.Agent.Windows.exe`" run"
sc.exe create $ServiceName binPath= $binPath start= auto DisplayName= $DisplayName | Out-Null

# Set service recovery options
Write-Log "Configuring service recovery options..."
sc.exe failure $ServiceName reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null

# Set service description
sc.exe description $ServiceName $Description | Out-Null

# Grant permissions to data directory
Write-Log "Configuring permissions..."
$acl = Get-Acl $programDataPath
$inheritanceFlags = [System.Security.AccessControl.InheritanceFlags]::ContainerInherit -bor [System.Security.AccessControl.InheritanceFlags]::ObjectInherit
$propagationFlags = [System.Security.AccessControl.PropagationFlags]::None
$accessRule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    "NT Service\$ServiceName",
    "FullControl",
    $inheritanceFlags,
    $propagationFlags,
    "Allow"
)
$acl.SetAccessRule($accessRule)
Set-Acl -Path $programDataPath -AclObject $acl

Write-Log ""
Write-Log "Installation complete!"
Write-Log "===================="
Write-Log "Service Name: $ServiceName"
Write-Log "Install Path: $InstallPath"
Write-Log "Data Path: $programDataPath"
Write-Log ""
Write-Log "To start the service:"
Write-Log "  Start-Service $ServiceName"
Write-Log ""
Write-Log "To check status:"
Write-Log "  Get-Service $ServiceName"
Write-Log ""
Write-Log "To view logs:"
Write-Log "  Get-Content `"$logsPath\agent-*.log`" -Tail 50 -Wait"
Write-Log ""
Write-Log "To uninstall:"
Write-Log "  .\uninstall-agent.ps1"
