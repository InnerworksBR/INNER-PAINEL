---
id: "001"
title: "Pipeline real de batches, assets e métricas"
status: planned
priority: critical
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: []
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005, RF-006]
---
# Especificação

## Objetivo e escopo

Substituir o processamento simulado do Monitoring Worker por um pipeline durável que valide registros, resolva a identidade de cada servidor, grave inventário e métricas, atualize estado/freshness e gere eventos consultáveis.

## Fora de escopo

- Renderização no React e rotas Fastify do portal.
- SNMP e Hyper-V, tratados em `006`.
- Rollups e retenção de longo prazo, tratados em `007`.

## Requisitos e critérios

### RF-001 — Processamento real e atômico

- **CA-001:** um batch válido cria/atualiza inventário, amostras, métricas atuais, bindings e estado antes de marcar job/batch como concluído.
- **CA-002:** falha parcial não deixa batch como concluído nem produz dados parcialmente confirmados.

### RF-002 — Uma máquina, um asset canônico

- **CA-003:** CPU, memória, uptime, sistema e volumes do mesmo host convergem para um único asset `host`.
- **CA-004:** hostname e fingerprint são normalizados; conflitos de identidade são registrados sem mesclar máquinas indevidamente.

### RF-003 — Métricas atuais e históricas

- **CA-005:** CPU, memória, uptime e discos são gravados com metric key, unidade, qualidade, dimensão e timestamps corretos.
- **CA-006:** reprocessar o mesmo `record_id` ou batch não duplica amostras nem eventos.

### RF-004 — Concorrência, retry e dead letter

- **CA-007:** claim usa transação com `FOR UPDATE SKIP LOCKED`; duas réplicas não processam o mesmo job simultaneamente.
- **CA-008:** erros transitórios usam backoff; erros permanentes chegam a dead letter com código sanitizado e reprocessamento auditável.

### RF-005 — Estado operacional

- **CA-009:** sucesso atualiza `last_seen`, freshness e estado; ausência de heartbeat/coleta move source/asset para stale/offline segundo política configurável.
- **CA-010:** mudanças relevantes produzem eventos/stream events idempotentes.

### RF-006 — Compatibilidade e recuperação

- **CA-011:** batches pendentes existentes podem ser processados; batches incorretamente concluídos pelo simulador têm procedimento de backfill/replay.
- **CA-012:** migrations são aditivas, indexadas e aplicáveis ao PostgreSQL 17 atual.

## Restrições

- PostgreSQL do Monitoring é a fonte de verdade; não haverá dual-write transacional para Supabase.
- Sem Redis, Kafka ou outro broker externo.
- Payloads e erros não podem expor tokens, credenciais ou PII desnecessária.

## Riscos

- Reprocessamento pode duplicar métricas sem chaves idempotentes adequadas.
- Registros atuais usam `asset_type` diferentes para CPU/memória/disco; o contrato deve normalizar antes do rollout.
- Marcação prematura de batches antigos pode exigir backfill controlado.
