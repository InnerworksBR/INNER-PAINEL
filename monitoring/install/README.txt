# Inner Monitoring Agent - Installation Guide

## Prerequisites
- .NET 8 Runtime (or self-contained deployment)
- Windows Server 2016+ / Windows 10+

## Installation

### Option 1: Interactive Installation
1. Open PowerShell as Administrator
2. Navigate to the agent directory
3. Run:
```powershell
.\install-agent.ps1
```

### Option 2: Silent Installation
```powershell
.\install-agent.ps1 -ActivationToken "YOUR_TOKEN_HERE" -ApiBaseUrl "https://api.innerworks.com.br"
```

## Directory Structure

```
C:\Program Files\InnerWorks\MonitoringAgent\
  - Inner.Monitoring.Agent.Windows.exe

C:\ProgramData\InnerWorks\MonitoringAgent\
  - config\
    - bootstrap.json
  - data\
    - agent.db (SQLite outbox)
    - secrets\ (DPAPI-protected credentials)
  - logs\
    - agent-YYYYMMDD.log
```

## Commands

### Install Service
```powershell
.\install-agent.ps1 -Install
```

### Uninstall Service
```powershell
.\install-agent.ps1 -Uninstall
```

### Run in Console Mode (for debugging)
```powershell
.\Inner.Monitoring.Agent.Windows.exe run
```

### Check Service Status
```powershell
sc query "Inner Monitoring Agent"
Get-Service "Inner Monitoring Agent"
```

### View Logs
```powershell
Get-Content "C:\ProgramData\InnerWorks\MonitoringAgent\logs\agent-$(Get-Date -Format 'yyyyMMdd').log" -Tail 50 -Wait
```

## Configuration

### bootstrap.json
```json
{
  "api_base_url": "https://api.innerworks.com.br",
  "heartbeat_interval_seconds": 60,
  "collection_interval_seconds": 15,
  "log_level": "Debug"
}
```

### Environment Variables
- `INNER_AGENT_API_URL` - Override API base URL
- `INNER_AGENT_LOG_LEVEL` - Override log level

## Troubleshooting

### Service Won't Start
1. Check logs: `C:\ProgramData\InnerWorks\MonitoringAgent\logs\`
2. Verify .NET 8 runtime is installed
3. Check Windows Event Viewer

### Database Issues
Delete `C:\ProgramData\InnerWorks\MonitoringAgent\data\agent.db` to reset outbox

### Token Issues
Delete `C:\ProgramData\InnerWorks\MonitoringAgent\data\secrets\` to clear credentials

## Collectors

The agent includes these collectors:
- **cpu** - CPU usage via GetSystemTimes
- **memory** - Memory usage via GlobalMemoryStatusEx
- **disk** - Disk space for all volumes
- **uptime** - System uptime via GetTickCount64
- **system_info** - Hostname, OS, architecture

## Security

- Credentials are protected with Windows DPAPI
- Tokens are stored per-user (CurrentUser scope)
- Secrets are encrypted with machine-specific keys
