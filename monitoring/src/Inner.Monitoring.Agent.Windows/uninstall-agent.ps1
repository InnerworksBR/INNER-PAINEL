# Inner Monitoring Agent - Windows Service Uninstaller
# Run as Administrator

param(
    [Parameter(Mandatory=$false)]
    [switch]$RemoveData
)

$ErrorActionPreference = "Stop"
$ServiceName = "InnerMonitoringAgent"
$ProgramDataPath = "$env:ProgramData\InnerWorks\MonitoringAgent"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message"
}

Write-Log "Uninstalling Inner Monitoring Agent..."
Write-Log "==================================="

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Log "ERROR: This script must be run as Administrator"
    exit 1
}

# Stop service if running
$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($service) {
    Write-Log "Stopping service..."
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
}

# Remove service
Write-Log "Removing service..."
sc.exe delete $ServiceName 2>$null | Out-Null

# Remove installation directory
$installPath = "$env:ProgramFiles\InnerWorks\MonitoringAgent"
if (Test-Path $installPath) {
    Write-Log "Removing installation directory: $installPath"
    Remove-Item -Path $installPath -Recurse -Force -ErrorAction SilentlyContinue
}

# Optionally remove data
if ($RemoveData) {
    Write-Log "Removing data directory: $ProgramDataPath"
    Remove-Item -Path $ProgramDataPath -Recurse -Force -ErrorAction SilentlyContinue
} else {
    Write-Log "Keeping data directory: $ProgramDataPath"
    Write-Log "  (use -RemoveData to delete)"
}

Write-Log ""
Write-Log "Uninstallation complete!"
