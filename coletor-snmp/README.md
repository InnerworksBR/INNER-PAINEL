# INNER PAINEL - Coletor SNMP

Coletor SNMP para descoberta automática de dispositivos de rede no Windows.

## Instalacao Rapida (Recomendado)

Baixe e execute o instalador automatico:

```powershell
# Execute como Administrador
powershell -ExecutionPolicy Bypass -File install-collector.ps1 `
  -PortalUrl "https://portal.inner.com.br" `
  -ActivationToken "INNER-KEY-XXXXXXXXXXXX" `
  -IpRangeStart "192.168.1.1" `
  -IpRangeEnd "192.168.1.254" `
  -CommunityString "public"
```

O instalador automatico:
- Instala .NET 8 SDK se necessario
- Registra o coletor no portal
- Compila o projeto automaticamente
- Instala como servico Windows

## Requisitos

- **.NET 8 SDK** ou superior (instalador faz automaticamente)
- Windows Server 2016+ ou Windows 10/11
- Acesso de rede aos dispositivos com SNMP habilitado (porta 161/UDP)
- PowerShell 5.1+ (para scripts de instalacao)

## Arquitetura

```
coletor-snmp/
├── config.json           # Configuração do coletor
├── SnmpCollector.csproj # Projeto .NET
├── src/
│   ├── Program.cs       # Entry point
│   ├── Models/
│   │   ├── NetworkDevice.cs
│   │   └── AppConfig.cs
│   └── Services/
│       ├── SnmpClient.cs    # Cliente SNMP
│       ├── Discovery.cs     # Descoberta de rede
│       └── DeviceParser.cs  # Parser de tipo de dispositivo
└── README.md
```

## Build

### 1. Restaurar dependências e compilar

```powershell
cd C:\Apps\INNER_PAINEL\coletor-snmp
dotnet restore
dotnet build -c Release
```

### 2. Publicar como executável self-contained

```powershell
dotnet publish -c Release -r win-x64 --self-contained true -o ./publish
```

O executável será gerado em `coletor-snmp\publish\ColetorSNMP.exe`.

## Configuração

Edite `config.json` conforme necessário:

```json
{
  "ApiBaseUrl": "http://seu-servidor:3000",
  "ApiToken": "seu-token-api",
  "Community": "public",
  "SnmpTimeoutMs": 3000,
  "MaxConcurrentScans": 10,
  "MaxIpsPerScan": 254,
  "ScanIntervalMinutes": 60,
  "RunAsService": false,
  "Logging": {
    "Level": "Information"
  },
  "ScanRanges": [
    {
      "Start": "192.168.1.1",
      "End": "192.168.1.254",
      "Community": "public"
    },
    {
      "Start": "10.0.0.1",
      "End": "10.0.0.50",
      "Community": "minha-community"
    }
  ]
}
```

### Variáveis de Ambiente

Você pode sobrescrever configurações via variáveis de ambiente com prefixo `SNMP_`:

| Variável | Descrição |
|----------|-----------|
| `SNMP_ApiBaseUrl` | URL base da API do portal |
| `SNMP_ApiToken` | Token de autenticação |
| `SNMP_Community` | Community string SNMP |
| `SNMP_RunAsService` | `true` para modo contínuo |
| `SNMP_ScanIntervalMinutes` | Intervalo entre scans (minutos) |

## Execução

### Modo Standalone (uma execução)

```powershell
.\publish\ColetorSNMP.exe
```

### Modo Serviço (loop contínuo)

```powershell
.\publish\ColetorSNMP.exe --RunAsService true
```

### Com argumentos via linha de comando

```powershell
.\publish\ColetorSNMP.exe --ApiBaseUrl=http://prod:3000 --RunAsService=true
```

## Instalação como Serviço Windows

### Opção 1: Windows Service com NSSM

O NSSM (Non-Sucking Service Manager) é recomendado por ser mais simples que TopShelf.

#### 1. Baixe o NSSM

```powershell
# Via Chocolatey (recomendado)
choco install nssm -y

# Ou baixe manualmente de https://nssm.cc/download
```

#### 2. Registre o serviço

```powershell
nssm install ColetorSNMP "C:\Apps\INNER_PAINEL\coletor-snmp\publish\ColetorSNMP.exe"
nssm set ColetorSNMP AppParameters "--RunAsService true"
nssm set ColetorSNMP AppDirectory "C:\Apps\INNER_PAINEL\coletor-snmp\publish"
nssm set ColetorSNMP DisplayName "INNER PAINEL - Coletor SNMP"
nssm set ColetorSNMP Description "Coletor SNMP para descoberta de dispositivos de rede"
nssm set ColetorSNMP Start SERVICE_AUTO_START
nssm set ColetorSNMP ObjectName "NT AUTHORITY\LocalService"
```

#### 3. Inicie o serviço

```powershell
nssm start ColetorSNMP
# ou
Start-Service ColetorSNMP
```

#### 4. Verifique status

```powershell
Get-Service ColetorSNMP
nssm status ColetorSNMP
nssm log ColetorSNMP
```

#### 5. Gerenciamento

```powershell
# Parar
nssm stop ColetorSNMP

# Reiniciar
nssm restart ColetorSNMP

# Remover
nssm remove ColetorSNMP confirm
```

### Opção 2: Task Scheduler (Agendador de Tarefas)

Para execução periódica sem serviço permanente.

#### Script de agendamento

```powershell
# Agendar execução a cada hora
$action = New-ScheduledTaskAction -Execute "C:\Apps\INNER_PAINEL\coletor-snmp\publish\ColetorSNMP.exe"
$trigger = New-ScheduledTaskTrigger -Once -At "09:00" -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 9999)
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Register-ScheduledTask -TaskName "INNER-ColetorSNMP" -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description "Coletor SNMP INNER PAINEL"
```

### Opção 3: TopShelf (pacote NuGet)

Edite `SnmpCollector.csproj` para adicionar TopShelf:

```xml
<PackageReference Include="TopShelf" Version="4.3.0" />
```

E modifique `Program.cs` para usar TopShelf:

```csharp
// No Main(), substitua o host.Run() por:
HostFactory.Run(config =>
{
    config.Service<SnmpCollectorService>(s =>
    {
        s.ConstructUsing(() => new SnmpCollectorService());
        s.WhenStarted(tc => tc.Start());
        s.WhenStopped(tc => tc.Stop());
    });

    config.RunAsLocalSystem();
    config.SetServiceName("ColetorSNMP");
    config.SetDisplayName("INNER PAINEL - Coletor SNMP");
    config.SetDescription("Coletor SNMP para descoberta de dispositivos");
});
```

## OIDs SNMP Suportados

### MIB-II (RFC 1213)

| OID | Nome | Descrição |
|-----|------|-----------|
| 1.3.6.1.2.1.1.1.0 | sysDescr | Descrição do sistema |
| 1.3.6.1.2.1.1.3.0 | sysUpTime | Tempo desde último boot |
| 1.3.6.1.2.1.1.5.0 | sysName | Nome do dispositivo |
| 1.3.6.1.2.1.2.1.0 | ifNumber | Número de interfaces |
| 1.3.6.1.2.1.2.2.1.2 | ifDescr | Descrição das interfaces |
| 1.3.6.1.2.1.2.2.1.7 | ifAdminStatus | Status administrativo |
| 1.3.6.1.2.1.2.2.1.8 | ifOperStatus | Status operacional |

## Tipos de Dispositivos Detectados

| Tipo | Fabricantes |
|------|-------------|
| Switch | Cisco, HP, Aruba, Dell, Juniper, TP-Link, Zyxel, D-Link |
| Router | MikroTik, Cisco ISR, Ubiquiti, Juniper SRX |
| Access Point | Cisco AIR, Meraki MR, Ubiquiti, Aruba, Ruckus |
| Firewall | Fortinet, Palo Alto, Cisco ASA, Sophos, WatchGuard |
| Printer | HP, Brother, Canon, Epson, Lexmark, Xerox |
| UPS | APC, Eaton, Vertiv |
| Storage | Synology, QNAP, NetApp, Dell, HP |

## Troubleshooting

### SNMP não responde

1. Verifique se o SNMP está habilitado no dispositivo
2. Teste com: `snmpwalk -v2c -c public <ip> 1.3.6.1.2.1.1.1.0`
3. Verifique firewall (porta 161/UDP)

### Windows Firewall

```powershell
# Permite SNMP inbound
New-NetFirewallRule -DisplayName "SNMP Coletor-In" -Direction Inbound -Protocol UDP -LocalPort 161 -Action Allow

# Se usar WMI para discovery ICMP
New-NetFirewallRule -DisplayName "ICMP-In" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -Action Allow
```

### Log verbose

```powershell
$env:SNMP_LOGGING__LEVEL = "Debug"
.\publish\ColetorSNMP.exe
```

## API de Integração

O coletor envia os dados descobertos para:

```
POST /api/snmp/devices
Content-Type: application/json
Authorization: Bearer <token>

{
  "ip": "192.168.1.1",
  "hostname": "sw-core-01",
  "deviceType": "Switch",
  "manufacturer": "Cisco",
  "model": "WS-C2960X-48FPS-L",
  "description": "Cisco IOS Software, Version 15.2(4)E10",
  "osVersion": "15.2(4)E10",
  "uptime": 3456000,
  "interfaceCount": 52,
  "location": "Rack A - Data Center",
  "community": "public",
  "interfaces": { ... },
  "lastSeen": "2026-08-01T10:30:00Z"
}
```

## Desinstalação

```powershell
# Remove serviço (NSSM)
nssm stop ColetorSNMP
nssm remove ColetorSNMP confirm

# Remove arquivos
Remove-Item -Recurse -Force C:\Apps\INNER_PAINEL\coletor-snmp

# Remove tarefas agendadas (se usado)
Unregister-ScheduledTask -TaskName "INNER-ColetorSNMP" -Confirm:$false
```
