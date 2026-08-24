---
id: "013"
title: "Zabbix — coleta confiável e histórico"
status: awaiting_approval
priority: high
risk: high
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010"]
requirements: [RF-020, RF-021, RF-022, RF-023, RF-024, RF-025, RF-026, RF-027, RF-028, RF-029]
---
# Especificação

## Objetivo e escopo

Substituir coletas repetitivas e semanticamente frágeis por um adaptador Zabbix com autenticação segura, timeout/retry, execução única, freshness, reconciliação e histórico sustentável. Servidores e rede passam a diferenciar saúde, atraso, ausência de item e falha da integração.

## Fora de escopo

- substituir o Zabbix ou alterar templates em produção;
- executar ações remotas em hosts;
- fixar retenção definitiva sem volume e SLO aprovados.

## Requisitos e critérios

- **RF-020 / CA-020:** token preferencial; login por usuário sempre com logout em `finally`.
- **RF-021/022 / CA-023:** timeout, retry/backoff/jitter, concorrência limitada e lease distribuído.
- **RF-023/024 / CA-021:** item stale/ausente não alimenta saúde; mapeamento configurável por template/OS.
- **RF-025 / CA-022:** uptime calculado em janela declarada; ausência vira “Sem dados”.
- **RF-026/027 / CA-024:** reconciliação de hosts e retenção/agregação.
- **RF-028/029:** eventos e diagnóstico de cobertura sem credenciais.

## Restrições e riscos

Versões suportadas e volume por cliente precisam ser medidos. API token depende da capacidade/configuração da instância; usuário/senha permanece apenas como compatibilidade segura.
