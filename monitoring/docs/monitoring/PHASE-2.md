# Fase 2: Inner Agent - Windows Service

## Visão Geral

O **Inner Agent** é um Windows Service que coleta métricas de host (CPU, memória, disco, uptime) e as envia para o pipeline de ingestão via outbox local SQLite.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    Inner Agent (Windows Service)              │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Workers   │  │ Collectors  │  │   Services           │ │
│  │             │  │             │  │                     │ │
│  │ AgentWorker │  │ CpuCollector│  │ EnrollmentService    │ │
│  │ (Background)│  │ MemoryCollector│  │ ConfigurationService│ │
│  │             │  │ DiskCollector│  │ HeartbeatService    │ │
│  │             │  │ UptimeCollector│ │ TokenService        │ │
│  │             │  │ SystemInfoCollector│                   │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                    │             │
│         └────────────────┼────────────────────┘             │
│                          ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │                 SqliteOutbox                        │    │
│  │  (Offline-first, WAL mode, 50MB max)               │    │
│  └─────────────────────────┬───────────────────────────┘    │
│                            │                                │
└────────────────────────────┼────────────────────────────────┘
                             │
                             ▼
                    ┌────────────────┐
                    │  API Gateway   │
                    │  (Phase 1)     │
                    └────────────────┘
```

## Estrutura de Diretórios

```
C:\Program Files\InnerWorks\MonitoringAgent\
  └── Inner.Monitoring.Agent.Windows.exe

C:\ProgramData\InnerWorks\MonitoringAgent\
  ├── config\
  │   └── bootstrap.json          # Configuração de bootstrap
  ├── data\
  │   ├── agent.db                # SQLite outbox
  │   ├── agent.db-wal            # Write-Ahead Log
  │   └── secrets\
  │       ├── activation.token     # Token de ativação (DPAPI)
  │       ├── access.token         # JWT access token (DPAPI)
  │       └── refresh.token        # JWT refresh token (DPAPI)
  └── logs\
      └── agent-YYYYMMDD.log       # Logs diários
```

## Coletores de Métricas

### IObservationCollector Interface

```csharp
public interface IObservationCollector
{
    string Name { get; }
    int Priority { get; }
    Task<CollectionResult> CollectAsync(CollectionContext context, CancellationToken ct);
}
```

### Coletores Implementados

| Collector | Priority | Métricas |
|-----------|----------|----------|
| SystemInfoCollector | 1 | hostname, OS, arch, processor_count |
| UptimeCollector | 5 | host.uptime.seconds |
| CpuCollector | 10 | host.cpu.usage_percent, host.cpu.idle_percent |
| MemoryCollector | 20 | host.memory.{usage,total,available,used}_bytes |
| DiskCollector | 30 | host.disk.{total,free,usage}_bytes por volume |

### P/Invoke APIs

- **GetSystemTimes** - Métricas de CPU (kernel + user time)
- **GlobalMemoryStatusEx** - Status de memória
- **GetDiskFreeSpaceEx** - Espaço em disco por volume
- **GetTickCount64** - Uptime do sistema
- **GetLogicalDrives** - Volumes montados

## Outbox Integration

O outbox SQLite implementa:

- **Offline-first**: Coleta e armazena localmente antes de enviar
- **WAL mode**: Melhor performance com write-ahead logging
- **Sequencing**: Cada batch tem um número de sequência único
- **Retry logic**: Reenvio automático de batches pendentes
- **Cleanup**: Purga automática de batches antigos (>7 dias)

### Schema

```sql
CREATE TABLE outbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id TEXT NOT NULL UNIQUE,
    sequence INTEGER NOT NULL,
    schema_version INTEGER NOT NULL,
    source_version TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    sent_at_utc TEXT,
    response TEXT
);

CREATE INDEX idx_outbox_status ON outbox(status, created_at);
CREATE INDEX idx_outbox_sequence ON outbox(sequence);
```

## Enrollment e Token Service

### Fluxo

1. Agent inicia com `activation_token` (arquivo DPAPI)
2. POST `/api/v1/sources/enroll` com token
3. Recebe `source_id`, `access_token` (15min), `refresh_token` (90 dias)
4. Armazena tokens com DPAPI encryption
5. Refresh automático quando token expira

### DPAPI Storage

Tokens são criptografados com DPAPI (Windows Data Protection):
- Usuário: `CurrentUser`
- Modo: `LocalMachine` para service account

## Heartbeat Service

Enviado a cada `heartbeat_interval_seconds` (default: 60s):

```json
{
  "source_id": "uuid",
  "timestamp": "2026-08-24T10:30:00Z",
  "status": "healthy",
  "outbox_size": 3,
  "outbox_bytes": 15234,
  "last_sequence": 1542,
  "last_heartbeat_at": "2026-08-24T10:29:00Z",
  "uptime_seconds": 86400,
  "memory_mb": 45,
  "version": "1.0.0",
  "capabilities": {
    "host_metrics": true,
    "hyperv": false,
    "snmp_v2c": false,
    "snmp_v3": false
  }
}
```

## Command Execution

Comandos suportados:

| Comando | Descrição | Handler |
|---------|-----------|---------|
| `collect_now` | Força coleta imediata | Trigger no AgentWorker |
| `diagnostics_run` | Retorna status dos collectors | CommandExecutor |
| `config_refresh` | Atualiza configuração | ConfigurationService |
| `outbox_status` | Status da outbox | SqliteOutbox |

## Instalação

### Requisitos

- Windows Server 2016+ ou Windows 10/11
- .NET 8 Runtime (embutido no self-contained)
- PowerShell 5.1+
- Permissões de Administrator

### Comandos

```powershell
# Instalar
.\install-agent.ps1 -ActivationToken "YOUR-TOKEN" [-ApiBaseUrl "https://api.example.com"]

# Desinstalar (mantém dados)
.\uninstall-agent.ps1

# Desinstalar (remove tudo)
.\uninstall-agent.ps1 -RemoveData

# Iniciar/Parar
Start-Service InnerMonitoringAgent
Stop-Service InnerMonitoringAgent

# Ver logs
Get-Content "C:\ProgramData\InnerWorks\MonitoringAgent\logs\agent-*.log" -Tail 50 -Wait
```

## Configuração

### bootstrap.json

```json
{
  "api_base_url": "https://api.innerworks.com.br",
  "heartbeat_interval_seconds": 60,
  "collection_interval_seconds": 15,
  "outbox_max_size_mb": 50,
  "outbox_retention_days": 7
}
```

### Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `INNER_AGENT_DATA_PATH` | Override do path de dados | `%PROGRAMDATA%\InnerWorks\MonitoringAgent` |

## Recovery Actions

O serviço está configurado com recovery automático:

- 1o failure: Restart em 60s
- 2o failure: Restart em 60s
- 3o+ failure: Restart em 60s
- Reset counter após 24h

## Build e Publish

```bash
cd C:\Apps\INNER_PAINEL\monitoring
dotnet publish src/Inner.Monitoring.Agent.Windows/Inner.Monitoring.Agent.Windows.csproj -c Release -r win-x64 --self-contained -o ./dist/InnerAgent
```

## Validação

```bash
cd C:\Apps\INNER_PAINEL\monitoring
dotnet build --project src/Inner.Monitoring.Agent.Windows
```

Saída esperada:
```
Compilação com êxito.
    0 Aviso(s)
    0 Erro(s)
```

## Troubleshooting

### Service não inicia

```powershell
# Verificar logs
Get-WinEvent -FilterHashtable @{LogName="Application";Level=2} -MaxEvents 20

# Verificar permissões
icacls "C:\ProgramData\InnerWorks\MonitoringAgent"

# Testar em modo console
.\Inner.Monitoring.Agent.Windows.exe run
```

### Outbox cheia

```powershell
# Ver tamanho
(Get-Item "C:\ProgramData\InnerWorks\MonitoringAgent\data\agent.db").Length / 1MB

# Reduzir retenção no bootstrap.json
"outbox_retention_days": 3
```

### Token expirado

```powershell
# Recriar token de ativação (requer API)
# Depois atualizar arquivo
Set-Content "C:\ProgramData\InnerWorks\MonitoringAgent\data\secrets\activation.token" -Value "NEW-TOKEN"
Restart-Service InnerMonitoringAgent
```
