# Inner Monitoring - Deployment Guide

## Prerequisites

- .NET 10 SDK
- PostgreSQL 16+
- Docker (optional)
- Kubernetes (for production)

## Development

### 1. Setup Database

```bash
# Using Docker Compose
docker-compose -f deploy/docker-compose.dev.yml up -d postgres

# Or connect to existing PostgreSQL
export DATABASE_URL="postgresql://user:pass@host:5432/db"
```

### 2. Run Migrations

```bash
# Apply migrations
psql $DATABASE_URL -f deploy/migrations/001_initial_schema.sql

# Or use EF Core
dotnet ef database update --project src/Inner.Monitoring.Infrastructure.Postgres
```

### 3. Build and Run

```bash
# Build
./scripts/build.ps1  # Windows
./scripts/build.sh   # Linux/Mac

# Run API
dotnet run --project src/Inner.Monitoring.Cloud.Api

# Run Worker (separate terminal)
dotnet run --project src/Inner.Monitoring.Cloud.Worker
```

## Production Deployment

### Docker

```bash
# Build images
docker build -t inner-monitoring-api -f src/Inner.Monitoring.Cloud.Api/Dockerfile .
docker build -t inner-monitoring-worker -f src/Inner.Monitoring.Cloud.Worker/Dockerfile .

# Run
docker run -d -p 5000:5000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET_KEY="..." \
  inner-monitoring-api

docker run -d \
  -e DATABASE_URL="postgresql://..." \
  inner-monitoring-worker
```

### Kubernetes

```bash
# Apply migrations first
kubectl apply -f deploy/kubernetes/migrations.yaml

# Deploy API
kubectl apply -f deploy/kubernetes/api.yaml

# Deploy Worker
kubectl apply -f deploy/kubernetes/worker.yaml

# Check status
kubectl get pods -l app=monitoring
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET_KEY` | Yes | JWT signing key (min 32 chars) |
| `SNMP_MASTER_KEY` | No | Master key for SNMP credentials |
| `ASPNETCORE_ENVIRONMENT` | No | "Development" or "Production" |

## Health Checks

```bash
# API Health
curl http://localhost:5000/health

# Readiness
curl http://localhost:5000/ready
```

## Monitoring

### Metrics Endpoint

```bash
curl http://localhost:5000/metrics
```

### Structured Logs

Logs are output in JSON format for easy parsing:

```json
{
  "Timestamp": "2026-08-24T12:00:00Z",
  "Level": "Information",
  "Message": "Batch processed",
  "BatchId": "...",
  "RecordCount": 100
}
```

## Troubleshooting

### Database Connection Issues

```bash
# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check migrations
dotnet ef database drop --project src/Inner.Monitoring.Infrastructure.Postgres
dotnet ef database update --project src/Inner.Monitoring.Infrastructure.Postgres
```

### High Memory Usage

- Check for memory leaks in custom collectors
- Verify SQLite WAL checkpoints
- Monitor PostgreSQL connection pool

### Batch Processing Delays

- Check worker logs for errors
- Verify database indexes exist
- Check for deadlocks

## Backup and Restore

### Backup

```bash
# PostgreSQL backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Restore

```bash
# PostgreSQL restore
psql $DATABASE_URL < backup_20260824.sql
```

## Security Checklist

- [ ] TLS enabled in production
- [ ] Strong JWT secret (>32 chars)
- [ ] Database credentials secured
- [ ] No secrets in logs
- [ ] Rate limiting configured
- [ ] Audit log enabled
- [ ] SNMP master key rotated
