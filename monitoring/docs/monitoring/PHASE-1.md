# Fase 1 - Pipeline Durável

## Visão Geral

A Fase 1 implementa o pipeline durável para recebimento e processamento de dados de monitoramento, garantindo:
- Entrega garantida de batches através da outbox local
- Processamento assíncrono com retry e dead letter
- Idempotência em todas as operações
- Alta disponibilidade com múltiplos workers

## Arquitetura

```
┌─────────────┐    HTTP     ┌─────────────┐   INSERT   ┌──────────────┐
│   Agent/    │ ─────────►  │  Cloud API  │ ─────────►│  PostgreSQL  │
│  Collector  │             │  (Ingest)   │            │              │
└─────────────┘             └─────────────┘            └──────┬───────┘
      │                                                         │
      │ ACK                                                     │ SELECT
      │◄────────────────────────────────────────────────────────┤
      │                           FOR UPDATE SKIP LOCKED          │
┌─────▼─────┐                                                 │
│  SQLite   │                                                 │
│  (Outbox) │◄────────────────────────────────────────────────┘
│           │            Lease Recovery                          │
└───────────┘
```

## Componentes Implementados

### 1. SQLite Outbox (`src/Inner.Monitoring.Infrastructure.Sqlite/`)

#### Tabelas Locais

| Tabela | Descrição |
|--------|-----------|
| `local_metadata` | Chave/valor para estado local |
| `outbox_batches` | Batches pendentes de envio |
| `applied_configurations` | Controle de versões de configuração |
| `command_receipts` | Receipts de comandos executados |
| `local_events` | Eventos locais para auditoria |

#### Classes

- **`SqliteOutboxDbContext`**: DbContext para SQLite local
- **`OutboxService`**: Gerencia persistência, ACK e retry com backoff exponencial + jitter
- **`OutboxSender`**: Envia batches pendentes para o servidor

#### Retry com Backoff Exponencial

```
Attempt 1:  5s  ± 1s
Attempt 2: 10s  ± 2s
Attempt 3: 20s  ± 4s
Attempt 4: 40s  ± 8s
Attempt 5: 80s  ± 16s
Attempt 6: 160s ± 32s
Attempt 7: 300s ± 60s (max)
```

### 2. Ingest API (`src/Inner.Monitoring.Cloud.Api/Controllers/`)

#### Endpoints

| Método | Endpoint | Descrição | Rate Limit |
|--------|----------|-----------|------------|
| POST | `/api/monitoring/v1/sources/register` | Registro de nova source | 5/10min/IP |
| POST | `/api/monitoring/v1/sources/{id}/batches` | Envio de batch | 100/min/source |
| POST | `/api/monitoring/v1/sources/{id}/heartbeat` | Heartbeat | 10/min/source |
| GET | `/api/monitoring/v1/sources/{id}/configuration` | Obter configuração | - |
| GET | `/api/monitoring/v1/sources/{id}/commands` | Obter comandos pendentes | - |

#### Fluxo de Recebimento de Batch

```
1. Validar Bearer token
2. Verificar idempotency (batch_id único)
   - Se duplicado: retornar "duplicate" idempotent
3. Decomprimir payload (gzip)
4. Parsear JSON do batch
5. Transação:
   a. INSERT ingest_batch
   b. INSERT processing_job
   c. UPDATE source_sequence_cursor
   d. UPDATE source.last_ingest_at
6. COMMIT
7. Retornar ACK (após commit)
```

#### Regras de Idempotência

- **batch_id** (UUID) é a chave de idempotência
- Duplicatas retornam `Status: "duplicate"` com os dados originais
- Sequências duplicadas são tratadas como duplicatas

### 3. Processing Worker (`src/Inner.Monitoring.Cloud.Worker/`)

#### BatchProcessingWorker

- Processa jobs do banco usando `FOR UPDATE SKIP LOCKED`
- Lease de 60 segundos por job
- Retry com backoff exponencial
- Dead letter após 10 tentativas

#### LeaseRecoveryWorker

- Recupera leases expirados após 10 minutos
- Verifica se worker original ainda está ativo
- Reprocessa jobs órfãos com backoff adicional

### 4. Contratos de Serialização (`src/Inner.Monitoring.Contracts/Records/`)

| Record | Descrição |
|--------|-----------|
| `BatchSubmission` | Envelope de batch |
| `BatchSubmissionResponse` | ACK de batch |
| `SourceRegistrationRequest` | Request de registro |
| `SourceRegistrationResponse` | Response de registro |
| `HeartbeatRequest` | Payload de heartbeat |
| `HeartbeatResponse` | Response de heartbeat |
| `SourceConfiguration` | Configuração versionada |

## Regras do SPEC Implementadas

| Regra | Implementação |
|-------|---------------|
| Confirmação após commit | ACK enviado após transação com sucesso |
| Duplicata idempotent | Verificação por batch_id antes de inserir |
| 429/503 mantém outbox | Batches retornam à outbox com retry |
| company_id da autenticação | company_id vem do JWT, nunca do payload |

## Configuração de Ambiente

```bash
# API
DATABASE_URL=Host=localhost;Database=inner_monitoring;Username=postgres;Password=postgres
JWT_SECRET_KEY=sua-chave-secreta-min-32-caracteres

# Worker
WORKER_ID=worker-01
WORKER_POLL_INTERVAL=5
WORKER_LEASE_DURATION=60
WORKER_MAX_ATTEMPTS=10
```

## Status da Implementação

### Concluídos
- [x] SQLite Outbox (DbContext, Service, Sender)
- [x] Contratos de Serialização
- [x] Repositórios (ISourceRepository, SourceRepository, IIngestBatchRepository, etc.)
- [x] Entidades Domain atualizadas (Command, SourceCredential, SourceSequenceCursor)
- [x] Entidades Domain existentes (Source, ActivationToken, etc.)
- [x] Configuração do DbContext (MonitoringDbContext)
- [x] Documentação

### Pendentes (requer integração com Fase 0)
- [ ] Cloud API Controllers (SourcesController, CommandsController)
- [ ] Processing Workers (BatchProcessingWorker, LeaseRecoveryWorker)
- [ ] Testes unitários
- [ ] Testes de integração

## Build e Testes

```bash
cd C:\Apps\INNER_PAINEL\monitoring

# Build completo (requer resolução de conflitos entre fases)
dotnet build

# Testes unitários do Domain
dotnet test tests/Inner.Monitoring.Domain.Tests/
```

### Status de Build

O build completo requer resolução de conflitos entre as Fases 0 e 1:
- `Inner.Monitoring.Application` tem erros de código incompleto
- `Inner.Monitoring.Cloud.Api` precisa de referências corrigidas
- Conflitos de tipos entre `SourceConfiguration` (Domain vs Contracts)

Os projetos base compilam com sucesso:
- Inner.Monitoring.Contracts
- Inner.Monitoring.Domain
- Inner.Monitoring.Infrastructure.Postgres
- Inner.Monitoring.Infrastructure
- Inner.Monitoring.Infrastructure.Sqlite
- Inner.Monitoring.Domain.Tests (14 testes passando)

## Dependências

- .NET 8.0
- PostgreSQL 14+
- Entity Framework Core 8.0
- SQLite (para outbox local)
