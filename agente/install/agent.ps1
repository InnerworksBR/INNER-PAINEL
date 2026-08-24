param(
    $PortalUrl = "",
    $Token = "",
    $IntervalSeconds = 60
)

$ErrorActionPreference = "SilentlyContinue"
$Script:HostName = $env:COMPUTERNAME
$Script:LastHeartbeat = Get-Date
$Script:OfflineBuffer = @()
$Script:ConfigFile = "$PSScriptRoot\config.json"

# Carregar config
if (Test-Path $Script:ConfigFile) {
    $config = Get-Content $Script:ConfigFile | ConvertFrom-Json
    if (-not $PortalUrl) { $PortalUrl = $config.portalUrl }
    if (-not $Token) { $Token = $config.token }
    if (-not $IntervalSeconds) { $IntervalSeconds = $config.intervalSeconds }
}

function Write-Log {
    param([string]$Message, [string]$Level = "INFO")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "$timestamp [`] `"
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
        }
    } catch { return $null }
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
                memory_total_mb = [math]::Round($_.MemoryStartup / 1MB)
                memory_used_mb = [math]::Round($_.MemoryAssigned / 1MB)
                status = $_.State.ToString()
            }
        })
    } catch { return @() }
}

function Send-Metrics {
    param($HostMetrics, $VMs)

    $body = @{
        asset_key = $Token
        idempotency_key = [guid]::NewGuid().ToString()
        collected_at = (Get-Date).ToUniversalTime().ToString("o")
        host = $HostMetrics
        virtual_machines = $VMs
    } | ConvertTo-Json -Depth 5

    try {
        Invoke-RestMethod -Uri "$PortalUrl/api/agent/metrics/v2" 
            -Method Post 
            -Headers @{ "Content-Type" = "application/json" } 
            -Body $body -TimeoutSec 30 | Out-Null
        return $true
    } catch {
        $Script:OfflineBuffer += @{ host = $HostMetrics; vms = $VMs }
        if ($Script:OfflineBuffer.Count -gt 10) { $Script:OfflineBuffer = $Script:OfflineBuffer[-10..-1] }
        return $false
    }
}

Write-Log "Inner Agent started - Portal: $PortalUrl"

while ($true) {
    $metrics = Get-HostMetrics
    $vms = Get-VMs
    if ($metrics) {
        Send-Metrics -HostMetrics $metrics -VMs $vms
    }
    Start-Sleep -Seconds $IntervalSeconds
}
