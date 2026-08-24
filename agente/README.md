# INNER PAINEL - Agente de Monitoramento (Windows)

Agente PowerShell para coleta de metricas de hosts Windows e VMs Hyper-V.

## Instalacao Rapida (Recomendado)

Baixe e execute o instalador automatico:

```powershell
# Execute como Administrador
powershell -ExecutionPolicy Bypass -File install-agent.ps1 `
  -PortalUrl "https://portal.inner.com.br" `
  -ActivationToken "INNER-KEY-XXXXXXXXXXXX"
```

O instalador automatico:
- Registra o agente no portal automaticamente
- Instala como servico Windows
- Configura inicializacao automatica
- Cria script de desinstalacao

## Instalacao Manual

### Requisitos

### Sistema
- Windows Server 2016+ ou Windows 10+
- PowerShell 5.1 ou superior
- Privilegios de Administrador (recomendado)

### Modulos
- Modulo `Hyper-V` (opcional, para coleta de VMs)
  - Instalar: `Install-WindowsFeature Hyper-V-PowerShell` (Server)
  - Ou: `Enable-WindowsOptionalFeature -Online -FeatureName Microsoft-Hyper-V-All` (Client)

### Permissoes WMI/Counter
- Acesso a `Win32_OperatingSystem`
- Acesso a `Win32_LogicalDisk`
- Acesso a `Win32_Processor`
- Leitura de contadores de performance (`Get-Counter`)

## Instalacao Manual

### 1. Copiar arquivos

```powershell
# Criar diretorio
New-Item -ItemType Directory -Path "C:\ProgramData\INNER_PAINEL" -Force

# Copiar script e config
Copy-Item inner-agent.ps1 "C:\ProgramData\INNER_PAINEL\"
Copy-Item config.example.json "C:\ProgramData\INNER_PAINEL\config.json"

# Criar diretorio de logs
New-Item -ItemType Directory -Path "C:\ProgramData\INNER_PAINEL\logs" -Force
```

### 2. Configurar

Edite `C:\ProgramData\INNER_PAINEL\config.json`:

```json
{
  "portal_url": "http://seu-servidor:3000",
  "asset_key": "SEU-ASSET-KEY",
  "agent_secret": "SEU-SECRET",
  "interval_seconds": 60,
  "heartbeat_interval_seconds": 300,
  "log_level": "INFO"
}
```

### 3. Executar teste

```powershell
# Teste com parametros via linha de comando
.\inner-agent.ps1 `
    -PortalUrl "http://servidor:3000" `
    -AssetKey "teste-host-01" `
    -AgentSecret "secret-teste" `
    -IntervalSeconds 30 `
    -VerboseMode
```

### 4. Executar como servico (NSSM)

Use o Non-Sucking Service Manager para instalar como servico Windows:

```powershell
# Baixar nssm
Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile "C:\nssm.zip"
Expand-Archive "C:\nssm.zip" -DestinationPath "C:\tools"
$nssm = "C:\tools\nssm-2.24\win64\nssm.exe"

# Instalar servico
& $nssm install "INNER_PAINEL_Agent" "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" "-ExecutionPolicy Bypass -File `"C:\ProgramData\INNER_PAINEL\inner-agent.ps1`" -PortalUrl `"http://servidor:3000`" -AssetKey `"host-01`" -AgentSecret `"secret`""

# Configurar recovery automatico
& $nssm set "INNER_PAINEL_Agent" "AppRestart" "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
& $nssm set "INNER_PAINEL_Agent" "AppStopMethodSkip" "6"

# Iniciar servico
Start-Service "INNER_PAINEL_Agent"

# Verificar status
Get-Service "INNER_PAINEL_Agent"
```

## Instalacao via Windows Service (PowerShell 7+)

Se usar PowerShell 7 (pwsh.exe):

```powershell
# Criar servico
New-Service -Name "INNER_PAINEL_Agent" `
    -BinaryPathName "C:\Program Files\PowerShell\7\pwsh.exe -ExecutionPolicy Bypass -File `"C:\ProgramData\INNER_PAINEL\inner-agent.ps1`" -PortalUrl `"http://servidor:3000`" -AssetKey `"host-01`" -AgentSecret `"secret`"" `
    -DisplayName "INNER PAINEL Agent" `
    -Description "Agente de monitoramento INNER PAINEL" `
    -StartupType Automatic

Start-Service "INNER_PAINEL_Agent"
```

## Parametros

| Parametro | Obrigatorio | Default | Descricao |
|-----------|-------------|---------|-----------|
| `PortalUrl` | Sim | - | URL base do portal INNER PAINEL |
| `AssetKey` | Sim | - | Chave unica do ativo |
| `AgentSecret` | Sim | - | Secret para autenticacao |
| `IntervalSeconds` | Nao | 60 | Intervalo de coleta (10-3600) |
| `HeartbeatIntervalSeconds` | Nao | 300 | Intervalo de heartbeat (30-3600) |
| `LogLevel` | Nao | INFO | Nivel de log: DEBUG, INFO, WARN, ERROR |
| `LogFile` | Nao | - | Caminho do arquivo de log |
| `VerboseMode` | Nao | false | Modo debug verboso |

## Metricas Coletadas

### Host
- **CPU**: Uso percentual, nucleos, processadores logicos
- **Memoria**: Total, usada, livre, percentual
- **Disco**: Espaco em cada volume (total, usado, livre)
- **Sistema**: Uptime, nome e versao do SO

### VMs Hyper-V (se disponivel)
- **CPU**: Contagem, uso, atribuicao dinamica
- **Memoria**: Atribuida, inicial, minima, maxima
- **Armazenamento**: Discos virtuais conectados
- **Rede**: Adaptadores e switches
- **Estado**: Running, Off, Paused, etc.

## Arquivos de Log

Logs sao gravados em:
- Padrao: `C:\ProgramData\INNER_PAINEL\logs\agent.log`
- Pode ser customizado via parametro `-LogFile`

Rotacao de log recomendada:
```powershell
# Limitar tamanho (PowerShell)
$logFile = "C:\ProgramData\INNER_PAINEL\logs\agent.log"
if ((Get-Item $logFile).Length -gt 10MB) {
    Move-Item $logFile "$logFile.old"
}
```

## Buffer Offline

O agente mantem um buffer de ate 10 metricas quando离线:
- Metricas sao salvas em memoria
- Sao enviadas automaticamente quando a conexao retorna
- Buffer persiste apenas durante a execucao (nao sobrevive reinicializacao)

## Troubleshooting

### Erro: "Get-Counter not found"
**Solucao**: Habilite o recurso "Windows PowerShell" ou instale o modulo de performance counters.

```powershell
# Windows Server
Install-WindowsFeature -Name "RSAT-PowerShell"

# Windows Client
Enable-WindowsOptionalFeature -Online -FeatureName "MicrosoftWindowsPowerShellV2"
```

### Erro: "Get-VM command not found"
**Solucao**: Instale o modulo Hyper-V PowerShell.

```powershell
# Windows Server
Install-WindowsFeature -Name "Hyper-V-PowerShell"

# Windows Client (requer Hyper-V instalado)
Enable-WindowsOptionalFeature -Online -FeatureName "Microsoft-Hyper-V-PowerShell"
```

### Erro: "Access Denied" em metricas de VM
**Solucao**: Execute o agente como Administrador.

### Agent nao conecta ao portal
Verifique:
1. Firewall permite conexao na porta do portal
2. URL correta no parametro `-PortalUrl`
3. Asset Key e Secret estao corretos

```powershell
# Testar conexao
Test-NetConnection -ComputerName "servidor" -Port 3000
```

### Servico nao inicia
```powershell
# Verificar logs do servico
Get-EventLog -LogName Application -Source "INNER_PAINEL" -Newest 50

# Verificar erro
& "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -ExecutionPolicy Bypass -File "C:\ProgramData\INNER_PAINEL\inner-agent.ps1" -PortalUrl "http://localhost:3000" -AssetKey "test" -AgentSecret "test"
```

### Verificar coleta de metricas
```powershell
# Executar em modo debug
.\inner-agent.ps1 `
    -PortalUrl "http://servidor:3000" `
    -AssetKey "test" `
    -AgentSecret "test" `
    -LogLevel "DEBUG" `
    -VerboseMode
```

## Desinstalacao

```powershell
# Parar servico
Stop-Service "INNER_PAINEL_Agent" -Force

# Remover servico (nssm)
& "C:\tools\nssm-2.24\win64\nssm.exe" remove "INNER_PAINEL_Agent" confirm

# Ou (PowerShell 7+)
Remove-Service "INNER_PAINEL_Agent"

# Remover arquivos (opcional)
Remove-Item "C:\ProgramData\INNER_PAINEL" -Recurse -Force
```

## API Endpoints

O agente espera os seguintes endpoints no portal:

| Metodo | Endpoint | Descricao |
|--------|----------|-----------|
| POST | `/api/agent/register` | Registro inicial do agente |
| POST | `/api/agent/heartbeat` | Heartbeat periodico |
| POST | `/api/agent/metrics/v2` | Envio de metricas |

### Body - Registro
```json
{
  "asset_key": "string",
  "secret": "string",
  "hostname": "string",
  "platform": "windows",
  "platform_version": "string",
  "agent_version": "string",
  "capabilities": ["host_metrics", "hyperv_metrics", "wmi"]
}
```

### Body - Heartbeat
```json
{
  "agent_id": "string",
  "asset_key": "string",
  "hostname": "string",
  "timestamp": "ISO8601",
  "status": "online|offline",
  "version": "string",
  "buffer_size": 0,
  "metrics_sent": 0
}
```

### Body - Metricas
```json
{
  "agent_id": "string",
  "asset_key": "string",
  "idempotency_key": "uuid",
  "metrics": [...],
  "collected_at": "ISO8601"
}
```
