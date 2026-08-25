# Inner Monitoring Agent - Debug Script
# Use this to run the agent in console mode with verbose logging

param(
    [switch]$Verbose,
    [switch]$Debug
)

$ErrorActionPreference = "Continue"

$ProgramDataPath = "$env:ProgramData\InnerWorks\MonitoringAgent"
$LogsPath = "$ProgramDataPath\logs"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Inner Agent - Debug Mode" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Program Data: $ProgramDataPath" -ForegroundColor Gray
Write-Host "Logs Path: $LogsPath" -ForegroundColor Gray
Write-Host ""

# Check .NET runtime
$dotnetVersion = & dotnet --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: .NET Runtime not found. Install .NET 8." -ForegroundColor Yellow
} else {
    Write-Host ".NET Version: $dotnetVersion" -ForegroundColor Gray
}

# Check service status
$service = Get-Service -Name "Inner Monitoring Agent" -ErrorAction SilentlyContinue
if ($service) {
    Write-Host ""
    Write-Host "Service Status: $($service.Status)" -ForegroundColor $(if ($service.Status -eq 'Running') { 'Green' } else { 'Yellow' })

    if ($service.Status -eq 'Running') {
        Write-Host ""
        Write-Host "WARNING: Service is running. Stop it before debugging:" -ForegroundColor Yellow
        Write-Host "  sc stop `"Inner Monitoring Agent`"" -ForegroundColor Gray
    }
}

# Show config
Write-Host ""
Write-Host "Bootstrap Configuration:" -ForegroundColor Cyan
$configPath = "$ProgramDataPath\config\bootstrap.json"
if (Test-Path $configPath) {
    Get-Content $configPath | ConvertFrom-Json | Format-List
} else {
    Write-Host "  Not configured. Run install-agent.ps1 first." -ForegroundColor Yellow
}

# Show recent logs
Write-Host ""
Write-Host "Recent Log Entries (last 20):" -ForegroundColor Cyan
$logFiles = Get-ChildItem -Path $LogsPath -Filter "*.log" -ErrorAction SilentlyContinue
if ($logFiles) {
    $latestLog = $logFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Get-Content $latestLog.FullName -Tail 20
} else {
    Write-Host "  No log files found." -ForegroundColor Yellow
}

# Show outbox status
Write-Host ""
Write-Host "Outbox Database:" -ForegroundColor Cyan
$dbPath = "$ProgramDataPath\data\agent.db"
if (Test-Path $dbPath) {
    Write-Host "  Database exists: $dbPath" -ForegroundColor Green
    Write-Host "  Size: $([math]::Round((Get-Item $dbPath).Length / 1KB, 2)) KB" -ForegroundColor Gray
} else {
    Write-Host "  Database not found (service may not have run yet)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Ask to run in console
$run = Read-Host "Run agent in console mode? [y/N]"
if ($run -eq 'y' -or $run -eq 'Y') {
    Write-Host ""
    Write-Host "Starting agent in console mode..." -ForegroundColor Cyan
    Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
    Write-Host ""

    $srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
    $exeFiles = Get-ChildItem -Path $srcDir -Filter "*.exe" -Recurse -ErrorAction SilentlyContinue

    if ($exeFiles.Count -eq 0) {
        Write-Host "ERROR: No executable found. Build the project first." -ForegroundColor Red
        exit 1
    }

    $exe = $exeFiles | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    & $exe.FullName run
}

Write-Host ""
