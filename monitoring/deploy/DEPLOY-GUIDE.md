# Inner Monitoring - Guia de Deploy em Produção

> **⚠️ IMPORTANTE:** Leia este documento completamente antes de iniciar o deploy.

## Índice

1. [Pré-requisitos](#pré-requisitos)
2. [Infraestrutura Necessária](#infraestrutura-necessária)
3. [Configuração de Variáveis de Ambiente](#configuração-de-variáveis-de-ambiente)
4. [Build das Imagens Docker](#build-das-imagens-docker)
5. [Deploy com Docker Compose](#deploy-com-docker-compose)
6. [Configuração do PostgreSQL](#configuração-do-postgresql)
7. [Verificação Pós-Deploy](#verificação-pós-deploy)
8. [Monitoramento](#monitoramento)
9. [Rollback](#rollback)
10. [Troubleshooting](#troubleshooting)

---

## Pré-requisitos

### Sistema
- [ ] Docker 24.0+ com Docker Compose v2
- [ ] PostgreSQL 16+ (pode ser externo)
- [ ] 2GB RAM mínimo (4GB recomendado)
- [ ] 20GB disco mínimo

### Acesso
- [ ] Acesso SSH ao servidor
- [ ] Permissão para criar containers
- [ ] Acesso ao banco PostgreSQL (criar usuário e banco)

---

## Infraestrutura Necessária

### Opção 1: PostgreSQL Externo (Recomendado)

Use um PostgreSQL gerenciado ou auto-hospedado:

**AWS RDS / Azure Database / Supabase / Neon**

Configuração mínima recomendada:
- PostgreSQL 16+
- Instance: db.t3.medium ou superior
- 100GB storage (com auto-scaling)
- Multi-AZ para produção
- Automated backups (7 dias mínimo)
- Point-in-time recovery

### Opção 2: PostgreSQL no Docker (Homologação)

```bash
# NÃO usar em produção com alta disponibilidade
postgres:
  image: postgres:16-alpine
  environment:
    POSTGRES_DB: inner_monitoring
    POSTGRES_USER: inner_monitoring
    POSTGRES_PASSWORD: "${POSTGRES_PASSWORD}"  # Usar variável!
  volumes:
    - pgdata:/var/lib/postgresql/data
  command:
    - "postgres"
    - "-c"
    - "max_connections=200"
    - "-c"
    - "shared_buffers=256MB"
    - "-c"
    - "effective_cache_size=1GB"
    - "-c"
    - "maintenance_work_mem=128MB"
    - "-c"
    - "wal_level=replica"
    - "-c"
    - "max_wal_senders=10"
    - "-c"
    - "checkpoint_timeout=10min"
```

---

## Configuração de Variáveis de Ambiente

### 1. Criar arquivo `.env.production`

```bash
# ===========================================
# Inner Monitoring - Configuração de Produção
# ===========================================

# ===========================================
# DATABASE
# ===========================================
# String de conexão do PostgreSQL
# IMPORTANTE: Usar SSL em produção!
DATABASE_URL="Host=seu-postgres-host;Port=5432;Database=inner_monitoring;Username=inner_monitoring;Password=SENHA_FORTE_AQUI;SSL Mode=Require;Trust Server Certificate=false"

# ===========================================
# JWT (OBRIGATÓRIO - GERAR COM COMANDO ABAIXO)
# ===========================================
# Gerar chave: openssl rand -base64 48
JWT_SECRET_KEY="COLE_A_CHAVE_GERADA_AQUI_MINIMO_32_CARACTERES"

# ===========================================
# WORKER
# ===========================================
WORKER_ID="prod-worker-01"
WORKER_POLL_INTERVAL="5"
WORKER_LEASE_DURATION="60"
WORKER_MAX_ATTEMPTS="10"

# ===========================================
# SERVIÇO
# ===========================================
ASPNETCORE_ENVIRONMENT="Production"
```

### 2. Gerar JWT Secret

```bash
# Gerar chave secreta forte
openssl rand -base64 48

# Output exemplo:
# kQx8vN3mZ7LpQ2wT5yH9bJcR4fE6gA1nS0dM8uX3iV2zW5yB
```

⚠️ **NUNCA use valores padrão ou de desenvolvimento em produção!**

---

## Build das Imagens Docker

### 1. Build da API

```bash
cd C:/Apps/INNER_PAINEL/monitoring

# Build com cache de múltiplos estágios
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -f src/Inner.Monitoring.Cloud.Api/Dockerfile \
  -t inner-monitoring-api:latest \
  -t inner-monitoring-api:1.0.0 \
  --push \
  .

# Tag para seu registry
docker tag inner-monitoring-api:latest your-registry.com/inner-monitoring-api:latest
docker push your-registry.com/inner-monitoring-api:latest
```

### 2. Build do Worker

```bash
docker build \
  --build-arg BUILDKIT_INLINE_CACHE=1 \
  -f src/Inner.Monitoring.Cloud.Worker/Dockerfile \
  -t inner-monitoring-worker:latest \
  -t inner-monitoring-worker:1.0.0 \
  --push \
  .

docker tag inner-monitoring-worker:latest your-registry.com/inner-monitoring-worker:latest
docker push your-registry.com/inner-monitoring-worker:latest
```

### 3. Build Multi-plataforma (opcional)

```bash
docker buildx create --use
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t your-registry.com/inner-monitoring-api:latest \
  --push \
  -f src/Inner.Monitoring.Cloud.Api/Dockerfile \
  .
```

---

## Deploy com Docker Compose

### 1. Preparar o Servidor

```bash
# Criar diretórios
mkdir -p /opt/inner-monitoring
cd /opt/inner-monitoring

# Criar arquivo de ambiente
cat > .env.production << 'EOF'
DATABASE_URL="Host=db.internal;Port=5432;Database=inner_monitoring;Username=inner_monitoring;Password=${POSTGRES_PASSWORD}"
JWT_SECRET_KEY="COLE_SUA_CHAVE_GERADA_AQUI"
WORKER_ID="prod-worker-01"
WORKER_POLL_INTERVAL="5"
WORKER_LEASE_DURATION="60"
WORKER_MAX_ATTEMPTS="10"
ASPNETCORE_ENVIRONMENT="Production"
EOF

# Proteger arquivo
chmod 600 .env.production
```

### 2. Copiar docker-compose.prod.yml

```bash
# Copiar do repositório
cp C:/Apps/INNER_PAINEL/monitoring/deploy/docker-compose.prod.yml /opt/inner-monitoring/docker-compose.yml

# Editar para usar seu registry
# Altere as linhas:
#   image: innerworks/inner-monitoring-api:latest
# Para:
#   image: your-registry.com/inner-monitoring-api:latest
```

### 3. Deploy

```bash
cd /opt/inner-monitoring

# Pull das imagens
docker compose pull

# Iniciar serviços (sem workers inicialmente)
docker compose up -d api

# Verificar se a API iniciou corretamente
docker compose logs -f api

# Verificar health check
curl http://localhost:5000/health/live

# Se OK, iniciar worker
docker compose up -d worker

# Verificar worker
docker compose logs -f worker
```

### 4. Verificar Health Checks

```bash
# Liveness
curl http://localhost:5000/health/live
# Expected: {"status":"Healthy","timestamp":"..."}

# Readiness
curl http://localhost:5000/health/ready
# Expected: {"status":"Healthy","entries":{...}}
```

---

## Configuração do PostgreSQL

### 1. Criar Banco e Usuário

```sql
-- Conectar como superuser (postgres)
psql -h seu-postgres-host -U postgres

-- Criar usuário
CREATE USER inner_monitoring WITH PASSWORD 'SENHA_FORTE';
GRANT CONNECT ON DATABASE inner_monitoring TO inner_monitoring;

-- Criar banco
CREATE DATABASE inner_monitoring OWNER inner_monitoring;

-- Conceder permissões no schema public (para migrations)
GRANT ALL ON SCHEMA public TO inner_monitoring;

-- Conectar no banco
\c inner_monitoring

-- Conceder permissões
GRANT ALL PRIVILEGES ON SCHEMA public TO inner_monitoring;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO inner_monitoring;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO inner_monitoring;

-- Para partições futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO inner_monitoring;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO inner_monitoring;
```

### 2. Rodar Migrations

```bash
# Via EF Core
cd /opt/inner-monitoring
docker compose exec api dotnet ef database update \
  --project src/Inner.Monitoring.Infrastructure.Postgres \
  --no-build

# Ou via script SQL gerado
dotnet ef migrations script \
  --project src/Inner.Monitoring.Infrastructure.Postgres \
  --output deploy/migrations.sql

# Rodar o script
psql -h seu-postgres-host -U inner_monitoring -d inner_monitoring -f deploy/migrations.sql
```

---

## Verificação Pós-Deploy

### 1. Testes de Integração

```bash
# Testar registro de source
curl -X POST http://localhost:5000/api/monitoring/v1/sources/register \
  -H "Content-Type: application/json" \
  -d '{
    "activation_token": "TOKEN_VALIDO_AQUI",
    "source_type": "agent",
    "installation_id": "00000000-0000-0000-0000-000000000001",
    "display_name": "Test Agent",
    "platform": "windows",
    "architecture": "x64",
    "source_version": "1.0.0",
    "hostname": "test-host",
    "capabilities": {
      "host_metrics": true,
      "hyperv": false
    }
  }'
```

### 2. Checklist de Produção

- [ ] Health check `/health/live` retorna 200
- [ ] Health check `/health/ready` retorna 200
- [ ] Logs não contêm erros
- [ ] Migrations aplicadas
- [ ] Partições criadas
- [ ] Variáveis de ambiente configuradas
- [ ] SSL/TLS configurado (reverse proxy)
- [ ] Backups do banco configurados
- [ ] Monitoramento configurado
- [ ] Alertas configurados

---

## Monitoramento

### Health Check Endpoint

```bash
# Verificar status completo
curl http://localhost:5000/health | jq .

# Verificar via Docker
docker inspect inner-monitoring-api --format='{{.State.Health.Status}}'
```

### Logs

```bash
# API logs
docker compose logs -f api --tail=100

# Worker logs
docker compose logs -f worker --tail=100

# Buscar erros
docker compose logs api | grep -i error
docker compose logs worker | grep -i error
```

### Métricas (se configurado)

```bash
# Se usar Prometheus + Grafana
# Adicionar ao docker-compose.yml:
metrics:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml
```

---

## Rollback

### Rollback de Imagem

```bash
cd /opt/inner-monitoring

# Ver tags disponíveis
docker images | grep inner-monitoring

# Parar serviços
docker compose down

# Pull da versão anterior
docker pull inner-monitoring-api:1.0.0
docker pull inner-monitoring-worker:1.0.0

# Editar docker-compose.yml para usar versão específica
# image: inner-monitoring-api:1.0.0
# image: inner-monitoring-worker:1.0.0

# Subir novamente
docker compose up -d
```

### Rollback de Database

```bash
# Apenas se necessário (CUIDADO!)
# Restore do backup mais recente
pg_restore -h seu-postgres-host -U postgres -d inner_monitoring \
  --clean \
  --if-exists \
  backup_latest.dump
```

---

## Troubleshooting

### Problema: API não inicia

```bash
# Ver logs
docker compose logs api

# Causas comuns:
# 1. DATABASE_URL inválido
# 2. JWT_SECRET_KEY não configurado
# 3. Banco inacessível
```

### Problema: Worker não processa jobs

```bash
# Verificar jobs pendentes
docker compose exec api curl http://localhost:5000/api/monitoring/v1/admin/jobs

# Verificar worker logs
docker compose logs worker | grep -i "error\|exception"

# Reiniciar worker
docker compose restart worker
```

### Problema: Health check falha

```bash
# Verificar banco
docker compose exec api pg_isready -h $DATABASE_HOST -U postgres

# Verificar migrations
docker compose exec api dotnet ef database update --dry-run

# Verificar partições
docker compose exec api psql "$DATABASE_URL" -c "SELECT * FROM pg_tables WHERE tablename LIKE 'metric_samples%'"
```

### Problema: Memory/Performance

```bash
# Ver uso de recursos
docker stats

# Aumentar limites no docker-compose.yml
# deploy:
#   resources:
#     limits:
#       memory: 2G
```

---

## Checklist Final de Produção

```markdown
## Antes de Colocar em Produção

### Segurança
- [ ] JWT_SECRET_KEY gerado com openssl rand -base64 48
- [ ] DATABASE_URL usa SSL Mode=Require
- [ ] Reverse proxy com HTTPS (TLS 1.2+)
- [ ] Rate limiting configurado no nginx
- [ ] CORS configurado corretamente
- [ ] AllowedHosts configurado

### Infraestrutura
- [ ] PostgreSQL 16+ com backups automatizados
- [ ] Connection pooling (PgBouncer) se necessário
- [ ] Multi-AZ para alta disponibilidade
- [ ] Monitoring (Prometheus/Grafana)
- [ ] Alerting configurado
- [ ] Log aggregation

### Código
- [ ] ASPNETCORE_ENVIRONMENT=Production
- [ ] Serilog em nível Warning/Error
- [ ] Health checks funcionando
- [ ] Zero erros em produção

### Operacional
- [ ] Runbook documentado
- [ ] Contato de suporte configurado
- [ ] Procedure de rollback testado
- [ ] Backup/restore testado
```

---

## Contatos de Emergência

```
API URL: http://localhost:5000
Health: http://localhost:5000/health

Containers:
- inner-monitoring-api
- inner-monitoring-worker

Logs: /var/lib/docker/containers/
```

---

*Última atualização: 2026-08-25*
*Versão: 1.0.0*
