# Fase 4: Portal Operacional - API de Consulta

## Visão Geral

Esta fase implementa a **API de Consulta e Endpoints do Portal** para o Inner Monitoring, fornecendo dados operacionais em tempo real para o painel de controle.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     Inner Painel (TypeScript)                    │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │              monitoring-api-client.ts                     │   │
│   │         (Cliente TypeScript para API REST + SSE)          │   │
│   └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS + JWT
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Monitoring API (.NET)                          │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                    Controllers                               │ │
│  │  CockpitController │ AssetsController │ EventsController    │ │
│  │  SourcesController │ StreamController │ PlatformController  │ │
│  │  ActivationTokens │ SnmpCredentials │ NetworkRanges        │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Query Services                              │ │
│  │  CockpitQueryService │ AssetQueryService                     │ │
│  │  SourceQueryService │ EventQueryService                     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                  Authorization                              │ │
│  │  PortalUserContext │ PortalClaims │ PortalJwtService        │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ EF Core
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL 16+                                │
│  monitoring.assets │ monitoring.sources │ monitoring.events      │
│  monitoring.asset_current_state │ monitoring.stream_events       │
└─────────────────────────────────────────────────────────────────┘
```

## Endpoints Implementados

### 1. Query API Endpoints

#### Cockpit
```
GET /api/monitoring/v1/companies/{companyId}/cockpit
```
Retorna resumo operacional com:
- Assets por estado de saúde
- Sources por status
- Eventos recentes (últimas 24h)
- Alertas ativos
- Cobertura de sites

#### Assets
```
GET /api/monitoring/v1/companies/{companyId}/assets
  ?site={guid}&type={type}&state={state}&source={guid}
  &text={search}&freshness={seconds}&tags={tag1,tag2}
  &page=1&page_size=50&sort_by={field}&sort_desc=true
  &cursor={opaque_cursor}

GET /api/monitoring/v1/companies/{companyId}/assets/{assetId}
```

#### Sources
```
GET /api/monitoring/v1/companies/{companyId}/sources
  ?site={guid}&type={agent|collector}&status={status}
  &text={search}&page=1&page_size=50
```

#### Events
```
GET /api/monitoring/v1/companies/{companyId}/events
  ?site={guid}&asset={guid}&event_type={type}
  &severity={critical|warning|info}&state={open|acknowledged|resolved}
  &from={ISO8601}&to={ISO8601}&page=1&page_size=50
```

#### Platform
```
GET /api/monitoring/v1/platform/health
```

### 2. SSE Stream

```
GET /api/monitoring/v1/companies/{companyId}/stream?cursor={sequence}
```

**Event Types:**
- `asset_state_changed` - Mudança de estado de saúde de um asset
- `source_status_changed` - Mudança de status de uma source
- `new_event` - Novo evento de monitoramento
- `metrics_updated` - Atualização de métricas

**Formato SSE:**
```
event: asset_state_changed
data: {"eventType":"asset_state_changed","eventId":"...","companyId":"...","timestamp":"...","payload":{...}}
```

### 3. Management Endpoints

#### Activation Tokens
```
POST /api/monitoring/v1/companies/{companyId}/activation-tokens
  Body: {"siteId":"...","sourceType":"Agent","displayHint":"Server Room 1"}

GET /api/monitoring/v1/companies/{companyId}/activation-tokens

DELETE /api/monitoring/v1/companies/{companyId}/activation-tokens/{tokenId}
```

#### SNMP Credentials
```
POST /api/monitoring/v1/companies/{companyId}/snmp-credentials
  Body: {"siteId":"...","name":"Corp SNMP","version":"v2c","authPassword":"..."}

GET /api/monitoring/v1/companies/{companyId}/snmp-credentials

DELETE /api/monitoring/v1/companies/{companyId}/snmp-credentials/{credentialId}
```

#### Network Ranges
```
POST /api/monitoring/v1/companies/{companyId}/network-ranges
  Body: {"siteId":"...","name":"Main Office","cidr":"192.168.1.0/24"}

GET /api/monitoring/v1/companies/{companyId}/network-ranges

DELETE /api/monitoring/v1/companies/{companyId}/network-ranges/{rangeId}
```

## DTOs de Resposta

### Contracts/Records

| Record | Descrição |
|--------|-----------|
| `CockpitResponse` | Resumo do cockpit operacional |
| `AssetListResponse` | Lista paginada de assets |
| `AssetDetailResponse` | Detalhes completos de um asset |
| `AssetSummary` | Resumo de um asset |
| `SourceListResponse` | Lista paginada de sources |
| `SourceResponse` | Detalhes de uma source |
| `EventListResponse` | Lista paginada de eventos |
| `EventResponse` | Detalhes de um evento |
| `StreamEvent` | Evento SSE |
| `ActivationTokenResponse` | Token de ativação |
| `SnmpCredentialResponse` | Credencial SNMP |
| `NetworkRangeResponse` | Range de rede |
| `PlatformHealthResponse` | Health da plataforma |

## Query Services

```csharp
public interface ICockpitQueryService
{
    Task<CockpitResponse> GetCockpitAsync(Guid companyId, CancellationToken ct);
}

public interface IAssetQueryService
{
    Task<PagedResult<AssetSummary>> ListAssetsAsync(AssetQuery query, CancellationToken ct);
    Task<AssetDetailResponse?> GetAssetDetailAsync(Guid companyId, Guid assetId, CancellationToken ct);
}

public interface ISourceQueryService
{
    Task<PagedResult<SourceResponse>> ListSourcesAsync(Guid companyId, SourceQuery query, CancellationToken ct);
}

public interface IEventQueryService
{
    Task<PagedResult<EventResponse>> ListEventsAsync(Guid companyId, EventQuery query, CancellationToken ct);
    Task<IReadOnlyList<EventResponse>> GetRecentEventsForAssetAsync(Guid companyId, Guid assetId, int limit, CancellationToken ct);
}
```

## Autorização

### JWT Claims
```json
{
  "user_id": "uuid",
  "company_id": "uuid",
  "role": "platform_admin|company_admin|operator|viewer|auditor",
  "email": "user@example.com"
}
```

### Hierarquia de Papéis
```
platform_admin (5)
    └── company_admin (4)
            └── operator (3)
                    └── viewer (2)
                            └── auditor (1)
```

### Regras de Acesso
- `company_id` vem SEMPRE do token JWT, nunca do request
- `platform_admin` pode acessar qualquer empresa
- Outros papéis só acessam dados da empresa no token

## Cliente TypeScript

```typescript
import { getMonitoringApiClient } from './services/monitoring-api-client';

const api = getMonitoringApiClient('https://api.example.com/api/monitoring/v1');
api.setToken(jwtToken);

// Cockpit
const cockpit = await api.getCockpit(companyId);

// Assets com paginação
const assets = await api.listAssets(companyId, {
  page: 1,
  pageSize: 50,
  state: 'warning',
});

// Asset detail
const asset = await api.getAsset(companyId, assetId);

// SSE Stream
const stream = api.createStreamConnection(companyId, {
  onEvent: (event) => console.log(event),
  onError: (err) => console.error(err),
});
stream.close();
```

## Build e Testes

```bash
# Build
cd C:/Apps/INNER_PAINEL/monitoring
dotnet build

# Testes
dotnet test

# Executar API
dotnet run --project src/Inner.Monitoring.Cloud.Api
```

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `DATABASE_URL` | String de conexão PostgreSQL | `postgresql://...` |
| `JWT_SECRET_KEY` | Chave secreta para JWT | `dev-secret-key...` |
| `ASPNETCORE_ENVIRONMENT` | Ambiente | `Development` |

## Status Codes

| Code | Significado |
|------|-------------|
| 200 | Sucesso |
| 201 | Criado |
| 204 | Sucesso sem conteúdo |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Recurso não encontrado |
| 429 | Rate limit excedido |
| 500 | Erro interno |

## Próximos Passos

- Fase 5: Dashboard em tempo real com WebSocket fallback
- Fase 6: Histórico e métricas analíticas
- Fase 7: Notificações e alertas push

---

**Data de Implementação:** 2024-08-25
**Versão:** 1.0.0
