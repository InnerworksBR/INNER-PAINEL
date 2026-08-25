# Inner Monitoring - Quick Start

## Deploy Rápido em 5 Passos

### 1. Preparar o PostgreSQL

```sql
-- Criar banco e usuário
CREATE USER inner_monitoring WITH PASSWORD 'SUA_SENHA_FORTE';
CREATE DATABASE inner_monitoring OWNER inner_monitoring;
GRANT ALL PRIVILEGES ON DATABASE inner_monitoring TO inner_monitoring;
```

### 2. Gerar JWT Secret

```bash
openssl rand -base64 48
# Guarde o resultado!
```

### 3. Criar arquivo de ambiente

```bash
cd deploy
cp .env.example .env.production

# Edite .env.production com:
# - DATABASE_URL (do passo 1)
# - JWT_SECRET_KEY (do passo 2)
```

### 4. Build e Deploy

```bash
# Dar permissão ao script
chmod +x deploy.sh

# Deploy
./deploy.sh production deploy
```

### 5. Verificar

```bash
# Health check
curl http://localhost:5000/health/live

# Se retornar {"status":"Healthy"} está OK!
```

## Comandos Úteis

```bash
# Ver status
docker compose ps

# Ver logs
docker compose logs -f api
docker compose logs -f worker

# Reiniciar
docker compose restart

# Parar
docker compose down
```

## Troubleshooting

### "API não responde"
```bash
# Ver logs
docker compose logs api

# Causa comum: DATABASE_URL incorreto
```

### "Health check falha"
```bash
# Verificar banco
docker compose exec api sh
dotnet ef database update --project src/Inner.Monitoring.Infrastructure.Postgres
```

---

**⚠️ Para produção completa, leia: `deploy/DEPLOY-GUIDE.md`**
