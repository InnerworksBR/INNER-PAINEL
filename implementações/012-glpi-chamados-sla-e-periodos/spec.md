---
id: "012"
title: "GLPI — chamados, SLA e períodos"
status: awaiting_approval
priority: high
risk: high
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010"]
requirements: [RF-010, RF-011, RF-012, RF-013, RF-014, RF-015, RF-016, RF-017, RF-018, RF-019]
---
# Especificação

## Objetivo e escopo

Fazer Chamados abrir com os últimos 30 dias e transformar SLA em indicador auditável. Lista, cards, busca, gráficos, SLA e CSV usam o mesmo filtro server-side; “Todo o histórico” continua disponível apenas por escolha explícita. A sincronização passa a incremental/idempotente, preserva campos brutos e mantém fallback do último detalhe válido.

## Fora de escopo

- SLA TTO, salvo confirmação contratual antes da execução;
- edição de ticket no GLPI;
- inventário GLPI (015).

## Requisitos e critérios

- **RF-010/011/013, CA-010/011:** períodos `7d/30d/90d/custom/all`, backend filtrando e paginando; default `30d` por criação.
- **RF-012:** lista, agregados e CSV compartilham filtro normalizado.
- **RF-014/015, CA-012/013:** `Cumprido`, `Em risco`, `Violado`, `Sem SLA`; denominador somente elegíveis, cobertura separada e amostra reconciliada com GLPI.
- **RF-016/017:** campos brutos/mapeamento versionado e sync incremental, idempotente, com reconciliação.
- **RF-018/019:** fallback no detalhe e dashboard geral no mesmo default.

## Restrições e riscos

Versão e search options do GLPI de homologação precisam ser capturados. Sem confirmação, o contrato principal usa TTR conforme hipótese aprovada no PRD.
