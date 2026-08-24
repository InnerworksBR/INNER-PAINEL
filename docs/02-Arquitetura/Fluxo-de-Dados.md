# 📊 Fluxo de Dados

## Visão Geral

Este documento descreve como os dados fluem através do sistema Portal Inner, desde as fontes externas até a interface do usuário.

---

## 🔄 Ciclo de Vida dos Dados

```mermaid
graph LR
    subgraph Sources["📥 Fontes"]
        Zabbix["Zabbix"]
        GLPI["GLPI"]
        MSGraph["MS Graph"]
        Agents["Agentes"]
    end
    
    subgraph Ingestion["⚙️ Ingestão"]
        Fetch["Fetch"]
        Transform["Transform"]
        Validate["Validate"]
    end
    
    subgraph Storage["💾 Armazenamento"]
        Cache["Cache"]
        Database["PostgreSQL"]
        Realtime["Realtime"]
    end
    
    subgraph Presentation["🎨 Apresentação"]
        API["REST API"]
        WebSocket["WebSocket"]
        UI["UI"]
    end
    
    Sources --> Ingestion
    Ingestion --> Storage
    Storage --> Presentation
```

---

## 📥 Fontes de Dados

### 1. Zabbix

```mermaid
sequenceDiagram
    participant B as Backend
    participant Z as Zabbix API
    participant DB as Database
    
    B->>Z: GET /api/itemhistory
    Z-->>B: Historical data
    B->>B: Process metrics
    B->>DB: UPSERT metrics
    Note over DB: Batch insert
```

**Dados coletados:**
- Métricas de CPU
- Uso de memória
- Tráfego de rede
- Espaço em disco
- Uptime

### 2. GLPI

```mermaid
sequenceDiagram
    participant B as Backend
    participant G as GLPI API
    participant DB as Database
    
    B->>G: GET /search/Ticket
    G-->>B: Tickets JSON
    B->>B: Extract relevant fields
    B->>DB: UPSERT tickets
    Note over DB: Deduplicate by ID
```

**Dados coletados:**
- Chamados abertos/fechados
- SLA status
- Categorias
- Tempo de resposta
- Tempo de resolução

### 3. Microsoft Graph

```mermaid
sequenceDiagram
    participant B as Backend
    participant M as MS Graph API
    participant DB as Database
    
    B->>M: GET /reports/getOffice365ServicesUserCounts
    M-->>B: Usage report
    B->>M: GET /users
    M-->>B: User list
    B->>M: GET /subscribedSkus
    M-->>B: License info
    B->>DB: Update all metrics
```

**Dados coletados:**
- Contagem de licenças
- Usuários ativos
- Uso do SharePoint
- Atividade do Teams

### 4. Agentes Python

```mermaid
graph LR
    A[Agente Python] -->|HTTP POST| B[Backend API]
    B -->|Validate| C[Process]
    C -->|Store| D[(DB)]
    D -->|Trigger| R[Realtime]
    R -->|Push| W[WebSocket]
```

**Dados enviados:**
- Métricas de sistema
- Eventos de log
- Status de serviços

---

## 🔧 Processamento

### Transformação de Dados

```typescript
// Exemplo: Transformar dados Zabbix
interface RawZabbixMetric {
  itemid: string;
  clock: string;
  value: string;
}

interface ProcessedMetric {
  serverId: string;
  metric: 'cpu' | 'memory' | 'network';
  value: number;
  timestamp: Date;
}

function transformZabbixData(raw: RawZabbixMetric[]): ProcessedMetric[] {
  return raw.map(item => ({
    serverId: extractServerId(item.itemid),
    metric: determineMetricType(item.itemid),
    value: parseFloat(item.value),
    timestamp: new Date(parseInt(item.clock) * 1000)
  }));
}
```

### Validação

```typescript
// Validação de dados antes de persistir
function validateMetric(metric: ProcessedMetric): boolean {
  return (
    isValidMetric(metric.metric) &&
    !isNaN(metric.value) &&
    metric.value >= 0 &&
    metric.timestamp instanceof Date
  );
}
```

---

## 💾 Armazenamento

### Estratégia de Cache

```mermaid
graph TD
    Request["Request"] --> Check["Cache Check"]
    Check -->|Hit| Response["Cached Response"]
    Check -->|Miss| Fetch["Fetch Source"]
    Fetch -->|Store| Cache["Update Cache"]
    Fetch -->|Store| Response
    
    Response --> End["Response"]
    Cache --> End
```

### TTL por Tipo de Dado

| Tipo | TTL | Razão |
|------|-----|-------|
| Dashboard summary | 30s | Alta frequência |
| Métricas servidores | 1min | Tempo real |
| Dados GLPI | 5min | Mudanças infrequentes |
| MS365 | 15min | Uso raro |
| Documentos | 1h | Estáticos |

---

## 🎨 Apresentação

### API REST

```typescript
// Endpoint típico
GET /api/client/dashboard/:contractId
  → Returns: { servers, ms365, tickets, alerts }

GET /api/client/servers/:contractId
  → Returns: { servers: Server[], metrics: Metrics[] }

GET /api/client/glpi/tickets/:contractId
  → Returns: { tickets: Ticket[], stats: SLAStats }
```

### WebSocket (Realtime)

```typescript
// Canais Realtime
const CHANNELS = {
  metrics: `metrics:contract:{contractId}`,
  alerts: `alerts:contract:{contractId}`,
  tickets: `tickets:contract:{contractId}`,
  servers: `servers:contract:{contractId}`
};

// Exemplo de subscrição
supabase
  .channel(CHANNELS.metrics)
  .on('postgres_changes', { 
    event: '*', 
    schema: 'public', 
    table: 'metrics' 
  }, handleMetricUpdate)
  .subscribe();
```

---

## 📊 Diagrama de Fluxo Completo

```mermaid
flowchart TB
    subgraph External["🔌 Fontes Externas"]
        Zabbix["Zabbix<br/>Servers, Network"]
        GLPI["GLPI<br/>Tickets, SLAs"]
        MSGraph["MS Graph<br/>Users, Licenses"]
        Agents["Agentes<br/>Custom Metrics"]
    end
    
    subgraph Backend["⚙️ Backend"]
        Cron["Cron Jobs"]
        API["REST API"]
        WS["WebSocket"]
    end
    
    subgraph Services["📦 Services"]
        ZS["Zabbix Service"]
        GS["GLPI Service"]
        MS["MS Graph Service"]
        AS["Agent Service"]
    end
    
    subgraph DB["💾 Database"]
        PG["PostgreSQL"]
        RT["Realtime"]
        ST["Storage"]
    end
    
    subgraph Frontend["🎨 Frontend"]
        UI["React UI"]
        Context["Context"]
        Cache["Local Cache"]
    end
    
    External -->|Scheduled Fetch| Services
    External -->|Agent Push| API
    
    Services -->|Store| PG
    Cron -->|Refresh| Services
    
    PG -->|Changes| RT
    RT -->|Push| WS
    WS -->|Updates| UI
    
    API -->|Data| UI
    UI -->|Cache| Cache
    
    style Zabbix fill:#d4efdf
    style GLPI fill:#fadbd8
    style MSGraph fill:#d6eaf8
    style Agents fill:#fdebd0
```

---

## 🔄 Fluxo de Sincronização

### Cron Jobs

```typescript
// backend/src/jobs/sync-scheduler.ts
cron.schedule('*/5 * * * *', async () => {
  // Sincroniza Zabbix a cada 5 minutos
  await syncZabbixMetrics();
});

cron.schedule('*/10 * * * *', async () => {
  // Sincroniza GLPI a cada 10 minutos
  await syncGLPITickets();
});

cron.schedule('*/15 * * * *', async () => {
  // Sincroniza MS365 a cada 15 minutos
  await syncMS365Data();
});
```

### Ordem de Execução

```mermaid
graph LR
    A["*/5min<br/>Zabbix"] --> B["*/10min<br/>GLPI"]
    B --> C["*/15min<br/>MS365"]
    
    A --> D["Health Check"]
    B --> D
    C --> D
    
    D --> E["Alerts"]
```

---

## 📈 Monitoramento de Dados

### Métricas de Qualidade

| Métrica | Target | Alerta |
|---------|--------|--------|
| Freshness | < 5min | > 10min |
| Error Rate | < 1% | > 5% |
| Latência | < 500ms | > 1s |

---

> **Última atualização:** 2026-08
