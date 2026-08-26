---
id: "004"
title: "Confiabilidade, instalação e gestão da frota Windows"
status: planned
priority: critical
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["001"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005, RF-006]
---
# Especificação

## Objetivo e escopo

Tornar o Agente Inner instalável e atualizável de forma idempotente em cada servidor Windows, resiliente a expiração de token e falhas de rede, com outbox durável, heartbeat fiel, configuração/comandos conectados e pacote rastreável.

## Fora de escopo

- Descoberta automática de máquinas sem instalação do agente.
- SNMP/Hyper-V avançado (`006`).
- Atualização automática assinada completa (`007`).

## Requisitos e critérios

### RF-001 — Ciclo de credenciais

- **CA-001:** token expirado/próximo do vencimento é renovado automaticamente; 401 dispara um refresh único e retry seguro.
- **CA-002:** refresh rotation, reinício e falha transitória não perdem credenciais nem criam loop agressivo.

### RF-002 — Entrega offline-first

- **CA-003:** batches permanecem até ACK, usam attempts/backoff/jitter/Retry-After e respeitam limite local.
- **CA-004:** 400 permanente é quarentenado; 401, 429 e 5xx têm tratamento distinto e logs sanitizados.

### RF-003 — Heartbeat e controle

- **CA-005:** heartbeat informa sequências, outbox, último ciclo, saúde, config e versão reais.
- **CA-006:** configuração é carregada no startup e atualizada periodicamente; comandos percorrem lease/start/complete idempotentes.

### RF-004 — Instalador idempotente

- **CA-007:** instalação nova, upgrade, repair e uninstall funcionam com serviço parado/rodando/marcado 1072.
- **CA-008:** upgrade preserva credenciais/config/outbox, atualiza binário e reinicia automaticamente se antes estava ativo.

### RF-005 — Distribuição de frota

- **CA-009:** pacote contém versão, checksum, assinatura/manifesto e runbook; artefato é reproduzível.
- **CA-010:** existe comando silencioso e retorno por exit code para RMM/GPO/Intune, com um token por máquina.

### RF-006 — Qualidade e compatibilidade

- **CA-011:** Windows Server 2019/2022 e Windows 10/11 x64 são cobertos ou restrições são declaradas.
- **CA-012:** reinício, indisponibilidade de 1 h, expiração de token e upgrade mantêm serviço saudável e backlog recuperável.

## Restrições

- Segredos em DPAPI LocalMachine e ACL restrita.
- Nenhum token em comando/log persistente além do bootstrap inicial inevitável; arquivo de ativação é removido após uso.
- Um agente representa uma máquina; não é inventário remoto de toda a rede.

## Riscos

- Instalador atual não reinicia upgrades sem novo token.
- Outbox atual não implementa attempts/backoff/limite, embora docs afirmem isso.
- Configuração e executor de comandos existem, mas não estão ligados ao loop normal.
