# Inner Monitoring - Operations Manual

## Overview

Inner Monitoring is a proprietary monitoring platform for Windows servers, Hyper-V environments, and SNMP network devices.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Network                            │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐│
│  │   Inner Agent       │    │    Inner Edge Collector          ││
│  │   (Windows Service) │    │    (Windows/Linux Service)       ││
│  └──────────┬───────────┘    └──────────────┬──────────────────┘│
│             │                                 │                  │
└─────────────┼─────────────────────────────────┼──────────────────┘
              │          HTTPS batches           │
              ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Cloud / Datacenter                           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    Monitoring API                           ││
│  └─────────────────────────────────────────────────────────────┘│
│                              │                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────┐  ┌─────────────────────────────┐   │  │
│  │  │  Monitoring     │  │  PostgreSQL                 │   │  │
│  │  │  Worker        │──│  (Batches, Jobs, Assets)    │   │  │
│  │  └─────────────────┘  └─────────────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Monitoring API

- Receives metric batches from agents and collectors
- Validates and persists batches
- Provides configuration and commands
- Runs health checks

### Monitoring Worker

- Processes metric batches
- Updates asset state
- Generates events
- Handles retries and dead letters

### Inner Agent (Windows)

- Collects host metrics
- Persists locally in SQLite
- Sends batches via HTTPS
- Receives commands

### Inner Edge Collector

- Discovers SNMP devices
- Polls network devices
- Manages credentials securely
- Reports to API

## Common Operations

### Check Service Health

```bash
# API
curl http://localhost:5000/health

# Worker
curl http://localhost:5001/health
```

### View Recent Batches

```sql
SELECT batch_id, source_id, sequence, status, received_at
FROM monitoring.ingest_batches
ORDER BY received_at DESC
LIMIT 20;
```

### Check Processing Jobs

```sql
SELECT id, batch_row_id, status, attempts, created_at
FROM monitoring.processing_jobs
WHERE status IN ('pending', 'leased', 'retrying')
ORDER BY priority, created_at
LIMIT 20;
```

### Monitor Asset State

```sql
SELECT a.display_name, acs.health, acs.last_success_at,
       acs.consecutive_failures, acs.last_failure_code
FROM monitoring.asset_current_state acs
JOIN monitoring.assets a ON a.id = acs.asset_id
WHERE a.company_id = 'your-company-id'
ORDER BY acs.last_success_at NULLS LAST;
```

### Check Failed Batches

```sql
SELECT id, batch_id, status, last_error_code, last_error_detail,
       processing_attempts
FROM monitoring.ingest_batches
WHERE status IN ('retrying', 'dead_letter')
ORDER BY received_at DESC;
```

### Reprocess Batch

```sql
-- Reset batch to pending
UPDATE monitoring.ingest_batches
SET status = 'received', processing_attempts = 0
WHERE id = 'batch-uuid';

-- Reset job
UPDATE monitoring.processing_jobs
SET status = 'pending', attempts = 0
WHERE batch_row_id = 'batch-uuid';
```

### View Audit Log

```sql
SELECT occurred_at, actor_type, action, entity_type, entity_id,
       before_data, after_data
FROM monitoring.audit_log
WHERE company_id = 'your-company-id'
ORDER BY occurred_at DESC
LIMIT 50;
```

## Maintenance

### Archive Old Batches

```sql
-- Archive processed batches older than 7 days
UPDATE monitoring.ingest_batches
SET status = 'archived'
WHERE status = 'processed'
  AND processed_at < NOW() - INTERVAL '7 days';
```

### Clean Dead Letter Jobs

```sql
-- Reset max-attempt jobs to retry
UPDATE monitoring.processing_jobs
SET status = 'pending', attempts = 0, last_error_code = NULL
WHERE status = 'dead_letter'
  AND attempts < max_attempts;
```

### Recalculate Asset State

```sql
-- Force state recalculation (requires worker restart)
DELETE FROM monitoring.asset_current_state
WHERE asset_id IN ('asset-uuid-1', 'asset-uuid-2');
```

## Alerts

### Source Offline

Alert when source hasn't sent heartbeat:

```sql
SELECT s.display_name, s.last_heartbeat_at,
       NOW() - s.last_heartbeat_at AS gap
FROM monitoring.sources s
WHERE s.status = 'online'
  AND s.last_heartbeat_at < NOW() - INTERVAL '3 minutes';
```

### High Processing Lag

Alert when batches queue is growing:

```sql
SELECT COUNT(*) AS pending_batches,
       MAX(received_at) AS oldest_batch,
       NOW() - MAX(received_at) AS lag
FROM monitoring.processing_jobs
WHERE status IN ('pending', 'retrying');
```

### Dead Letter Accumulation

Alert when dead letter jobs are increasing:

```sql
SELECT COUNT(*) AS dead_letters
FROM monitoring.processing_jobs
WHERE status = 'dead_letter'
  AND created_at > NOW() - INTERVAL '1 hour';
```

## Troubleshooting

### Agent Not Reporting

1. Check agent service is running
2. Verify network connectivity to API
3. Check agent logs for errors
4. Verify source status in database

### Batches Stuck in Processing

1. Check worker is running
2. Verify database connection
3. Look for deadlock in logs
4. Check processing job status

### High CPU/Memory

1. Check for memory leaks
2. Verify SQLite checkpoints
3. Review batch sizes
4. Monitor connection pool

## Support

For issues, contact the monitoring team with:

- Batch ID
- Source ID
- Timestamp
- Error logs
