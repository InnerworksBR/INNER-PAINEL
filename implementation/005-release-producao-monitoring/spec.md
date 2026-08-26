---
id: "005"
title: "Release, observabilidade e aceite em produção"
status: planned
priority: critical
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["001", "002", "003", "004"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005, RF-006]
---
# Especificação

## Objetivo e escopo

Transformar o conjunto implementado em uma release operável: gates verdes, migrations controladas, API/Worker/backend/web implantados, observabilidade e alertas mínimos, piloto real, rollout e rollback documentados.

## Fora de escopo

- Implantar sem aprovação explícita.
- Declarar SNMP/Hyper-V/updates concluídos; ficam em `006/007`.

## Requisitos e critérios

### RF-001 — Qualidade da release

- **CA-001:** builds/typecheck/lint e testes afetados ficam verdes; placeholders não contam como cobertura.
- **CA-002:** testes cobrem registro→coleta→processamento→consulta→portal e isolamento tenant.

### RF-002 — Banco e migrations

- **CA-003:** backup restaurável, migration dry-run, versão registrada e rollback não destrutivo.
- **CA-004:** migrator termina com sucesso e API readiness confirma schema compatível.

### RF-003 — Serviços EasyPanel

- **CA-005:** API, Worker, backend e web rodam commits aprovados; Worker tem container ativo e processa backlog.
- **CA-006:** health/recursos/redes/secrets estão configurados sem exposição e com critério de rollback.

### RF-004 — Observabilidade e suporte

- **CA-007:** alertas cobrem API indisponível, Worker ausente, lag, dead letter, source offline e erro de bridge.
- **CA-008:** correlation ID permite seguir uma coleta do agente ao portal; runbook contém consultas seguras.

### RF-005 — Piloto e rollout

- **CA-009:** agente piloto aparece no portal com métricas e histórico; segunda empresa comprova isolamento.
- **CA-010:** rollout gradual registra resultados e interrompe automaticamente em erro/lag acima do limite.

### RF-006 — Documentação e aceite

- **CA-011:** docs refletem .NET 8, EasyPanel, URLs/health reais, instalação, backup e rollback.
- **CA-012:** aceite final lista evidências, limitações e riscos; nenhuma tarefa P0 aberta.

## Restrições

- Cada deploy/restart/migration exige aprovação específica no momento da ação.
- Secrets nunca entram em Git, logs ou relatório.
- Worker sem health HTTP precisa de sinal operacional alternativo confiável.

## Riscos

- Worker está configurado no EasyPanel, mas sem container atual.
- API em produção não está no commit mais recente; auto deploy está desligado.
- Web tem falhas preexistentes de teste/lint que precisam ser resolvidas ou formalmente segregadas antes do gate.
