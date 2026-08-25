# Inner Monitoring

Sistema próprio de monitoramento de servidores Windows, ambientes Hyper-V e equipamentos de rede via SNMP para o Inner Painel.

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                        Rede do Cliente                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │   Inner Agent       │    │    Inner Edge Collector          ││
│  │   (Windows Service) │    │    (Windows/Linux Service)        ││
│  │   SQLite Outbox      │    │    SQLite Outbox                 ││
│  └──────────┬───────────┘    └──────────────┬──────────────────┘│
│             │                                 │                   │
│             │    ┌──────────────────────┐    │                   │
│             │    │  Equipamentos SNMP   │    │                   │
│             │    └──────────────────────┘    │                   │
└─────────────┼─────────────────────────────────┼───────────────────┘
              │          HTTPS batches           │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nuvem / Datacenter                           │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Monitoring API                          │  │
│  │   POST /sources/{id}/batches (ingestão durável)          │  │
│  │   POST /sources/{id}/heartbeat                          │  │
│  │   GET  /sources/{id}/configuration                      │  │
│  │   GET  /sources/{id}/commands                           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                              │                                   │
│  ┌───────────────────────────┼───────────────────────────────┐   │
│  │                           ▼                               │   │
│  │   ┌─────────────────┐  ┌─────────────────────────────┐  │   │
│  │   │  Monitoring     │  │  PostgreSQL                 │  │   │
│  │   │  Worker         │──│  (Ingest batches, Jobs,     │  │   │
│  │   │  (Processamento)│  │   Assets, Métricas, etc)    │  │   │
│  │   └─────────────────┘  └─────────────────────────────┘  │   │
│  └───────────────────────────────────────────────────────────┘   │
│                              │                                   │
│                              ▼                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                    Inner Painel (TypeScript)               │  │
│  │   Cockpit │ Assets │ Events │ Commands │ Audit            │  │
│  └─────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Stack Técnica

- **Linguagem:** C# / .NET 10 LTS
- **Cloud API:** ASP.NET Core 10
- **Cloud Worker:** .NET Worker Service 10
- **Windows Agent:** .NET Worker Service 10 (Windows)
- **Edge Collector:** .NET Worker Service 10 (Windows/Linux)
- **Banco Central:** PostgreSQL 16+
- **Banco Local:** SQLite (WAL mode)
- **SNMP:** SharpSnmpLib incorporado
- **Transporte:** HTTPS/JSON/gzip

## Projetos

| Projeto | Descrição |
|---------|-----------|
| `Inner.Monitoring.Contracts` | Contratos, DTOs, enums |
| `Inner.Monitoring.Domain` | Entidades e lógica de domínio |
| `Inner.Monitoring.Infrastructure.Postgres` | Acesso ao PostgreSQL via EF Core |
| `Inner.Monitoring.Infrastructure.Sqlite` | Acesso ao SQLite (outbox local) |
| `Inner.Monitoring.Cloud.Api` | API de ingestão e controle |
| `Inner.Monitoring.Cloud.Worker` | Worker de processamento |
| `Inner.Monitoring.Agent.Windows` | Agente Windows (futuro) |
| `Inner.Monitoring.Edge.Collector` | Coletor SNMP (futuro) |

## Requisitos

- .NET 10 SDK
- PostgreSQL 16+ (ou PostgreSQL 18 para desenvolvimento)
- Docker (opcional, para desenvolvimento)

## Configuração

### Variáveis de Ambiente

```bash
# Database
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres

# JWT
JWT_SECRET_KEY=sua-chave-secreta-de-256-bits-mínimo-32-caracteres

# API (opcional)
ASPNETCORE_ENVIRONMENT=Development
```

### Desenvolvimento Local com Docker

```bash
# Subir PostgreSQL local
docker-compose -f deploy/docker-compose.dev.yml up -d postgres

# Definir DATABASE_URL para local
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/postgres"

# Executar migrations
dotnet ef database update --project src/Inner.Monitoring.Infrastructure.Postgres

# Rodar API
dotnet run --project src/Inner.Monitoring.Cloud.Api

# Rodar Worker (outro terminal)
dotnet run --project src/Inner.Monitoring.Cloud.Worker
```

## Build

```bash
# Restaurar dependências
dotnet restore

# Build
dotnet build

# Executar testes
dotnet test

# Publicar API
dotnet publish src/Inner.Monitoring.Cloud.Api -c Release -o ./publish/api

# Publicar Worker
dotnet publish src/Inner.Monitoring.Cloud.Worker -c Release -o ./publish/worker
```

## API Endpoints

### Ingestão

```
POST /api/monitoring/v1/sources/{sourceId}/batches
  - Headers: Authorization: Bearer <token>, Content-Encoding: gzip
  - Body: Batch JSON (comprimido gzip)
  - Response: ACK com batch_id, sequence, status

POST /api/monitoring/v1/sources/{sourceId}/heartbeat
  - Body: Heartbeat payload
  - Response: Server time, desired config version, commands available
```

### Registro

```
POST /api/monitoring/v1/sources/register
  - Body: Activation token + source info
  - Response: source_id, access_token, refresh_token, config

POST /api/monitoring/v1/sources/token/refresh
  - Body: refresh_token
  - Response: Novo access_token + refresh_token
```

### Configuração

```
GET /api/monitoring/v1/sources/{sourceId}/configuration
  - Headers: If-None-Match: "version-hash"
  - Response: Config JSON ou 304 Not Modified
```

### Comandos

```
GET /api/monitoring/v1/sources/{sourceId}/commands
  - Response: Lista de comandos pendentes

POST /api/monitoring/v1/sources/{sourceId}/commands/{commandId}/start
POST /api/monitoring/v1/sources/{sourceId}/commands/{commandId}/complete
```

## Testes

```bash
# Executar todos os testes
dotnet test

# Executar com cobertura
dotnet test --collect:"XPlat Code Coverage"

# Executar testes específicos
dotnet test --filter "FullyQualifiedName~Domain.Tests"
```

## Deploy

### Kubernetes (exemplo)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-api
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api
        image: inner-monitoring-api:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: database-url
        - name: JWT_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: jwt-secret
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: monitoring-worker
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: worker
        image: inner-monitoring-worker:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: monitoring-secrets
              key: database-url
```

## Documentação

- [SPEC.md](./docs/SPEC.md) - Especificação técnica completa
- [PRD.md](./docs/PRD.md) - Documento de produto
- [OPERATIONS.md](./docs/OPERATIONS.md) - Manual de operações
- [SECURITY.md](./docs/SECURITY.md) - Práticas de segurança

## Licença

Proprietário © Innerworks
