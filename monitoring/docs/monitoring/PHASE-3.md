# Fase 3 - Inner Edge Collector

## Visão Geral

O **Inner Edge Collector** é um serviço on-premise para descoberta SNMP e polling de dispositivos de rede. Ele executa em ambientes Windows ou Linux como um Worker Service, integrado ao ecossistema Inner Monitoring.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                    Inner Edge Collector                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐│
│  │ Discovery Cycle │  │  Polling Cycle  │  │ Credential Mgmt ││
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘│
│           │                    │                    │          │
│  ┌────────▼────────────────────▼────────────────────▼────────┐│
│  │                    Core Components                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     ││
│  │  │Range Planner │  │DeviceClassif.│  │ProfileResolver│     ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘     ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     ││
│  │  │ConcurrencyLim│  │PollingExecutor│  │ SnmpClient   │     ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘     ││
│  └────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────▼─────────────────────────────────┐│
│  │                   SharpSnmpLib                               ││
│  │              SNMP v1/v2c/v3 Support                         ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Componentes

### 1. SNMP Client Adapter (`Snmp/`)

**Interface:**
```csharp
public interface ISnmpClient
{
    Task<SnmpResponse> GetAsync(string host, int port, SnmpCredential credential, string[] oids, CancellationToken ct);
    Task<SnmpWalkResult> WalkAsync(string host, int port, SnmpCredential credential, string rootOid, CancellationToken ct);
    Task<SnmpWalkResult> BulkWalkAsync(string host, int port, SnmpCredential credential, string rootOid, int maxVariables, CancellationToken ct);
}
```

**Implementação:** `SharpSnmpClient`
- SNMP v1, v2c, v3
- v3: noAuthNoPriv, authNoPriv (MD5/SHA), authPriv (DES/AES)
- Timeout configurável
- Retry automático

**MIB-II OIDs:** `Mib2Oids.cs`
- System Group: sysDescr, sysObjectID, sysUpTime, sysName, sysLocation
- Interfaces: ifTable (ifIndex, ifDescr, ifSpeed, ifPhysAddress, ifAdminStatus, ifOperStatus, ifInOctets, ifOutOctets, ifInErrors, ifOutErrors)
- IP, TCP, UDP groups

### 2. Range Planner (`Discovery/`)

**Interface:**
```csharp
public interface IRangePlanner
{
    IEnumerable<IPAddress> EnumerateCandidates(CidrRange range, IEnumerable<CidrRange>? exclusions);
}
```

**Features:**
- Parse de CIDR: `192.168.1.0/24`
- Exclusão de network/broadcast
- **Streaming** - não materializa milhões de IPs
- Split para paralelização

**Exemplo:**
```csharp
var range = CidrRange.Parse("192.168.1.0/24");
foreach (var ip in rangePlanner.EnumerateCandidates(range, exclusions))
{
    // Process IP without loading all into memory
}
```

### 3. Discovery Pipeline (`Discovery/`)

```
1. Enumerate candidates from CIDR range
2. Apply exclusions
3. SNMP identity probe (MIB-II system group)
4. Classify device by sysObjectID + sysDescr
5. Assign profile
6. Schedule polling
```

**Resultado:** `DiscoveredDevice`
- Host, Port, Credential
- AssetType (switch, router, access_point, etc)
- DisplayName, Manufacturer, Model
- CollectionProfile

### 4. Asset Classifier (`Classification/`)

**Interface:**
```csharp
public interface IDeviceClassifier
{
    ClassificationResult Classify(IdentityProbeResult probe);
}
```

**Métodos de classificação:**
1. **sysObjectID prefix** - Identificação primária (fabricante + tipo)
2. **sysDescr patterns** - Padrões textuais (Catalyst, Juniper, etc)
3. **sysServices** - Hints do nível de serviço

**Tipos suportados:**
| Tipo | Descrição |
|------|-----------|
| switch | Switch de rede gerenciável |
| router | Roteador |
| access_point | Ponto de acesso WiFi |
| firewall | Firewall de rede |
| ups | No-break |
| printer | Impressora de rede |
| network_device | Dispositivo genérico |
| unknown_device | Não classificado |

**OID Prefixes implementados:**
- Cisco (1.3.6.1.4.1.9.1)
- HP/Aruba (1.3.6.1.4.1.11.2, 1.3.6.1.4.1.14823)
- Juniper (1.3.6.1.4.1.2636)
- Dell (1.3.6.1.4.1.6027)
- Huawei (1.3.6.1.4.1.2011)
- Ubiquiti (1.3.6.1.4.1.41112)
- MikroTik (1.3.6.1.4.1.14988)
- Fortinet (1.3.6.1.4.1.12356)
- Palo Alto (1.3.6.1.4.1.25461)
- Check Point (1.3.6.1.4.1.2620)
- APC/Eaton UPS (1.3.6.1.4.1.318, 1.3.6.1.4.1.534)

### 5. Profile Resolver (`Profiles/`)

**Perfis declarativos (`config/profiles.json`):**
```json
{
  "profile_id": "switch-standard",
  "poll_interval_seconds": 300,
  "queries": [
    {"operation": "get", "oids": ["1.3.6.1.2.1.1.3.0"]},
    {"operation": "bulk_walk", "root_oid": "1.3.6.1.2.1.2.2", "max_variables": 100},
    {"operation": "walk", "root_oid": "1.3.6.1.2.1.17"}
  ]
}
```

**Operações:**
- `get` - GET SNMP simples
- `walk` - WALK iterativo (GETNEXT)
- `bulk_walk` - GETBULK eficiente

### 6. Concurrency Control (`Concurrency/`)

**Interface:**
```csharp
public interface IConcurrencyLimiter
{
    Task<T> ExecuteAsync<T>(string key, Func<Task<T>> work, CancellationToken ct);
}
```

**Limites configuráveis:**
| Limite | Padrão | Descrição |
|--------|--------|-----------|
| Identity Probes | 64 | Sondagens simultâneas |
| Polling Devices | 16 | Dispositivos em polling |
| Requests/sec | 200 | Taxa global |

### 7. Credential Management (`Security/`)

**Interface:**
```csharp
public interface ICredentialManager
{
    void CacheCredential(SnmpCredential credential);
    SnmpCredential? GetCachedCredential(Guid credentialId);
    void InvalidateCredential(Guid credentialId);
    void InvalidateByVersion(int keyVersion);
}
```

**Features:**
- Recebe credenciais criptografadas da API
- Descriptografa com master key
- Cache local (em memória)
- Invalidação por version change

## Configuração

### appsettings.json
```json
{
  "Collector": {
    "CycleIntervalSeconds": 60,
    "SnmpTimeoutMs": 3000,
    "SnmpRetries": 3,
    "MaxConcurrentProbes": 64,
    "MaxConcurrentPolling": 16,
    "MaxRequestsPerSecond": 200
  }
}
```

### Master Key
```bash
# Via arquivo
echo "0123456789ABCDEF..." > master.key

# Via variável de ambiente
export INNER_MASTER_KEY=0123456789ABCDEF...
```

## Compilação e Execução

### Compilação
```bash
cd C:\Apps\INNER_PAINEL\monitoring
dotnet build --project src/Inner.Monitoring.Edge.Collector
```

### Execução
```bash
dotnet run --project src/Inner.Monitoring.Edge.Collector
```

### Publicação
```bash
dotnet publish src/Inner.Monitoring.Edge.Collector -c Release -r win-x64 --self-contained
dotnet publish src/Inner.Monitoring.Edge.Collector -c Release -r linux-x64 --self-contained
```

## Fluxo de Dados

```
1. API Cloud
   └─> Credenciais criptografadas
   └─> Network Ranges
   └─> Collection Profiles

2. Edge Collector
   ├─> Descoberta (ciclos)
   │  ├─> Range Planner (enumera IPs)
   │  ├─> Probes SNMP (64 simultâneas)
   │  ├─> Classifier (sysObjectID + sysDescr)
   │  └─> Profile Resolver
   │
   └─> Polling (ciclos)
      ├─> Polling Executor (16 devices)
      ├─> Queries por perfil
      └─> Métricas salvas

3. Métricas
   └─> Outbox SQLite
   └─> API Cloud (batching)
```

## Estrutura de Diretórios

```
src/Inner.Monitoring.Edge.Collector/
├── Program.cs                          # Entry point + DI
├── EdgeCollectorHostedService.cs        # Background service
├── Snmp/
│   ├── ISnmpClient.cs                  # Interface
│   ├── SharpSnmpClient.cs              # SharpSnmpLib implementation
│   ├── SnmpResponse.cs                 # Response types
│   └── Mib2Oids.cs                     # MIB-II OID constants
├── Discovery/
│   ├── CidrRange.cs                    # CIDR type
│   ├── CidrRangePlanner.cs             # Range enumeration
│   └── SnmpDiscoveryPipeline.cs        # Discovery orchestration
├── Classification/
│   └── NetworkDeviceClassifier.cs      # Device type classification
├── Profiles/
│   └── ProfileResolver.cs              # Profile resolution
├── Concurrency/
│   └── ConcurrencyLimiter.cs           # Semaphore-based limiter
├── Security/
│   └── CredentialManager.cs           # Credential caching
├── Polling/
│   └── PollingExecutor.cs              # Metrics collection
├── config/
│   └── profiles.json                    # Declarative profiles
└── appsettings.json                     # Configuration
```

## Métricas Coletadas

### MIB-II System
- sysUpTime (1.3.6.1.2.1.1.3.0)

### MIB-II Interfaces
- ifIndex, ifDescr, ifType, ifSpeed
- ifPhysAddress (MAC)
- ifAdminStatus, ifOperStatus
- ifInOctets, ifOutOctets
- ifInErrors, ifOutErrors
- ifInDiscards, ifOutDiscards

### Por tipo de dispositivo
| Tipo | OIDs adicionais |
|------|-----------------|
| Switch | dot1dBridge, dot1dTpFdbEntry |
| Router | ipAddrTable, ipRouteTable |
| UPS | UPS-MIB (1.3.6.1.2.1.33) |
| Printer | Printer-MIB (1.3.6.1.2.1.43) |

## Troubleshooting

### SNMP Timeout
- Verificar firewall (porta 161/UDP)
- Aumentar `SnmpTimeoutMs`
- Verificar comunidade SNMP

### Autenticação Falha
- Verificar credenciais
- Confirmar community string
- Para v3: verificar username e auth protocol

### Alta Memória
- Range muito grande (/8 ou maior)
- Verificar que Range Planner usa streaming
- Reduzir `MaxConcurrentProbes`
