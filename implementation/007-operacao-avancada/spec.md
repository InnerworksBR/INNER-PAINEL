---
id: "007"
title: "Operação avançada do Monitoring"
status: planned
priority: medium
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["001", "002", "005"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005]
---
# Especificação

## Objetivo e escopo

Ativar e comprovar capacidades avançadas já presentes parcialmente no código: rollups, retenção, alertas, comandos duráveis, updates assinados, diagnostics e saúde da plataforma.

## Fora de escopo

- Bloquear o MVP de servidores Windows.
- Executar comandos destrutivos arbitrários nos endpoints.

## Requisitos e critérios

### RF-001 — Rollup e retenção
- **CA-001:** jobs 5m/1h são idempotentes, observáveis e produzem séries corretas.
- **CA-002:** retenção elimina somente dados elegíveis, preserva auditoria e usa partitions sem locks prolongados.

### RF-002 — Alertas
- **CA-003:** regras de source offline, stale, CPU/mem/disk e dead letter abrem/resolvem eventos sem flapping.

### RF-003 — Comandos remotos
- **CA-004:** allowlist, lease, timeout, idempotência, resultado e auditoria ponta a ponta; nenhuma shell arbitrária.

### RF-004 — Atualizações assinadas
- **CA-005:** manifesto/artefato são verificados, rollout gradual e rollback preservam dados; falha de assinatura bloqueia.

### RF-005 — Operação da plataforma
- **CA-006:** worker heartbeat, lag, dead letters, partitions e jobs de manutenção aparecem em health/cockpit.
- **CA-007:** diagnostics CLI e runbooks executam consultas seguras e sanitizadas.

## Restrições

- Retenção/migration/deploy exigem aprovação e backup.
- Comandos e updates exigem revisão de segurança independente.

## Riscos

- Serviços atuais de rollup/alert/update podem existir sem agendamento ou integração real.
- Comando remoto amplia superfície de ataque e deve permanecer desligado até aprovação.
