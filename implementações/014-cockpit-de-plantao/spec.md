---
id: "014"
title: "Cockpit de plantão"
status: awaiting_approval
priority: high
risk: medium
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["012", "013", "016"]
requirements: [RF-030, RF-031, RF-032, RF-033, RF-034, RF-035, RF-036]
---
# Especificação

## Objetivo e escopo

Entregar ao admin Inner uma tela única com clientes priorizados por criticidade e quatro sinais confiáveis: ativos, SLA, integrações e freshness. Cada alerta possui origem, horário, drill-down e reconhecimento; falha operacional é distinta de falha/atraso de coleta.

## Fora de escopo

- acesso de usuário cliente;
- automação de remediação ou abertura/fechamento automático de chamados;
- escalas/on-call e notificações externas nesta versão.

## Requisitos e critérios

- **RF-030/031 / CA-030:** todos os clientes contratados aparecem com sinais aplicáveis e criticidade explicável.
- **RF-032:** filtros por cliente, severidade, origem e estado.
- **RF-033 / CA-031:** alerta com timestamp, origem, resumo, reconhecimento e drill-down no escopo correto.
- **RF-034:** incidente, stale, indisponibilidade da integração e módulo não contratado são estados distintos.
- **RF-035:** pesos/thresholds configuráveis e auditados.
- **RF-036:** última tentativa, sucesso e duração por integração.

## Restrições e riscos

O cockpit não pode mascarar incerteza com score. Sua ativação depende das semânticas de GLPI, Zabbix e health da 016 convergirem.
