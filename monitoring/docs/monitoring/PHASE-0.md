# Fase 0 - Fundacao

**Status:** Implementado
**Data:** 2026-08-25

## Overview

Esta fase implementa a infraestrutura fundamental do Inner Monitoring:
- Schema do banco de dados PostgreSQL com EF Core
- Repositorios base
- Logging estruturado
- Health checks
- Docker Compose para desenvolvimento

## Estrutura de Projetos

```
src/
├── Inner.Monitoring.Contracts/       # Contratos e DTOs compartilhados
├── Inner.Monitoring.Domain/           # Entidades e logica de dominio
├── Inner.Monitoring.Infrastructure.Postgres/  # DbContext, Repositorios
├── Inner.Monitoring.Application/      # Servicos de aplicacao
├── Inner.Monitoring.Cloud.Api/         # API REST
└── Inner.Monitoring.Cloud.Worker/     # Worker para processamento
```

## 1. Migrations EF Core

### Tabelas Criadas

#### Core
- `monitoring.sites` - Sites/empresas
- `monitoring.activation_tokens` - Tokens para registro de fontes
- `monitoring.sources` - Fontes de dados (agentes, coletores)
- `monitoring.source_credentials` - Credenciais JWT das fontes
- `monitoring.source_configurations` - Configuracoes por fonte
- `monitoring.source_sequence_cursors` - Cursores de sequencia

#### Detalhes
- `monitoring.source_heartbeats` - Heartbeats das fontes (PARTICIONADA por mes)
- `monitoring.agent_details` - Detalhes de agentes Windows
- `monitoring.collector_details` - Detalhes de coletores

#### SNMP/Network
- `monitoring.snmp_credentials` - Credenciais SNMP
- `monitoring.network_ranges` - Ranges de rede para descoberta
- `monitoring.range_credential_bindings` - Associacoes range/credencial

#### Profiles/Assets
- `monitoring.collection_profiles` - Perfis de coleta
- `monitoring.assets` - Ativos descobertos
- `monitoring.asset_identifiers` - Identificadores de ativos
- `monitoring.asset_source_bindings` - Bindings ativo/fonte
- `monitoring.asset_identity_conflicts` - Conflitos de identidade

#### Metricas
- `monitoring.metric_definitions` - Definicoes de metricas
- `monitoring.ingest_batches` - Batches recebidos
- `monitoring.source_sequence_gaps` - Gaps de sequencia
- `monitoring.processing_jobs` - Jobs de processamento
- `monitoring.collection_attempts` - Tentativas de coleta (PARTICIONADA)
- `monitoring.metric_samples` - Samples de metricas (PARTICIONADA por hora)
- `monitoring.asset_current_state` - Estado atual dos ativos
- `monitoring.asset_metric_current` - Metricas atuais
- `monitoring.metric_rollups_5m` - Agregados 5min (PARTICIONADA por dia)
- `monitoring.metric_rollups_1h` - Agregados 1h (PARTICIONADA por mes)

#### Eventos
- `monitoring.monitoring_events` - Eventos de monitoramento
- `monitoring.stream_events` - Eventos de stream (PARTICIONADA por mes)
- `monitoring.commands` - Comandos para fontes
- `monitoring.audit_log` - Log de auditoria (PARTICIONADA por mes)

### Particionamento

Todas as tabelas particionadas usam `RANGE` partitioning:

| Tabela | Granularidade | Particoes Pre-criadas |
|--------|--------------|----------------------|
| source_heartbeats | Mensal | 12 meses |
| collection_attempts | Mensal | 12 meses |
| metric_samples | Horaria | 168 horas (7 dias) |
| metric_rollups_5m | Diaria | 90 dias |
| metric_rollups_1h | Mensal | 12 meses |
| stream_events | Mensal | 12 meses |
| audit_log | Mensal | 12 meses |

## 2. DbContext

`MonitoringDbContext` localizado em:
`src/Inner.Monitoring.Infrastructure.Postgres/MonitoringDbContext.cs`

### Caracteristicas
- Schema padrao: `monitoring`
- Configuracao de indice para cada tabela
- Configuracao de particionamento
- Modelagem correta de relacionamentos

## 3. Repositorios Base

### ISourceRepository / SourceRepository
Localizacao: `src/Inner.Monitoring.Infrastructure.Postgres/Repositories/`

Operacoes:
- CRUD de Sources
- Gerenciamento de credenciais
- Gerenciamento de configuracoes
- Sequence cursors
- Heartbeats
- Detalhes de agentes/coletores
- Tokens de ativacao

### IAssetRepository / AssetRepository

Operacoes:
- CRUD de Assets
- Identificadores de assets
- Bindings fonte/ativo
- Estado atual
- Metricas atuais
- Conflitos de identidade

### IIngestBatchRepository / IngestBatchRepository

Operacoes:
- CRUD de Batches
- Gaps de sequencia
- Collection attempts
- Estatisticas

### IProcessingJobRepository / ProcessingJobRepository

Operacoes:
- Gerenciamento de jobs
- Definicoes de metricas
- Samples de metricas
- Agregados (rollups)

## 4. Logging Estruturado

### Configuracao Serilog
- Output JSON para console
- Enrichers: MachineName, Environment
- Correlation ID middleware

### Middleware de Correlation ID
Localizacao: `src/Inner.Monitoring.Cloud.Api/Middleware/CorrelationIdMiddleware.cs`

- Header: `X-Correlation-ID`
- Geracao automatica de UUID se nao fornecido
- Propagacao para todos os logs

### Redactor de Segredos
Localizacao: `src/Inner.Monitoring.Cloud.Api/Infrastructure/LogRedactor.cs`

Padroes redatados:
- Passwords e secrets
- JWT tokens
- Authorization headers
- Credenciais SNMP
- Private keys

## 5. Health Checks

### Endpoints
- `/health/live` - Liveness probe (app respondendo)
- `/health/ready` - Readiness probe (DB, migrations, particoes)
- `/health` - Health check detalhado (verbose)

### Health Checks Implementados

#### DatabaseHealthCheck
- Verifica conexao ao banco
- Verifica migrations pendentes
- Verifica existencia do schema

#### MigrationsHealthCheck
- Lista migrations pendentes

#### PartitionHealthCheck
- Verifica configuracao de particionamento

## 6. Docker Compose

Arquivo: `docker-compose.yml`

### Servicos
- **postgres**: PostgreSQL 16 Alpine
  - Porta: 5432
  - Volume persistente
  - Health check

- **redis**: Redis 7 Alpine
  - Porta: 6379
  - Para cache futuro

- **pgadmin**: PgAdmin 4 (dev only)
  - Porta: 5050
  - Profile: `dev-tools`

### Init Scripts
`init-scripts/01-init-schema.sql`

Executado automaticamente:
- Criacao de schema
- Criacao de particoes (12 meses para tabelas mensais)
- Indices globais
- Comentarios

### Uso

```bash
# Iniciar servicos
docker-compose up -d

# Iniciar com pgadmin
docker-compose --profile dev-tools up -d

# Ver logs
docker-compose logs -f postgres

# Parar servicos
docker-compose down
```

## Variaveis de Ambiente

```bash
# Database
DATABASE_URL=Host=localhost;Database=inner_monitoring;Username=postgres;Password=postgres

# JWT
JWT_SECRET_KEY=sua-chave-secreta-min-32-caracteres
```

## Build e Teste

```bash
# Restaurar dependencias
dotnet restore

# Build
dotnet build

# Executar migrations
dotnet ef database update --project src/Inner.Monitoring.Infrastructure.Postgres

# Testes
dotnet test

# Executar API
dotnet run --project src/Inner.Monitoring.Cloud.Api
```

## Regras Implementadas

1. **company_id NUNCA vem do payload** - Sempre do token JWT autenticado
2. **Todos os timestamps em UTC** - DateTimeOffset.UtcNow
3. **Particionamento para performance** - Tabelas de alto volume particionadas
4. **Soft delete** - Campo `deleted_at` em entidades
5. **Auditoria** - Tabela audit_log com todas as mudancas

## Proximas Etapas

- Fase 1: Implementar autenticacao e registro de fontes
- Fase 2: Implementar endpoint de ingestao de batches
- Fase 3: Implementar processamento de metricas
- Fase 4: Implementar rollups e agregados
