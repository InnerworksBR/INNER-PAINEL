---
id: "006"
title: "Monitoramento de rede SNMP e Hyper-V"
status: planned
priority: medium
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["001", "002", "004"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005]
---
# Especificação

## Objetivo e escopo

Concluir capacidades já anunciadas de Edge Collector SNMP e Hyper-V: coleta real, identidade, credenciais, processamento e visualização de dispositivos/VMs.

## Fora de escopo

- Bloquear o marco prioritário de servidores Windows.
- Suportar protocolos além de SNMP v2c/v3 e Hyper-V definidos.

## Requisitos e critérios

### RF-001 — SNMP real
- **CA-001:** Get/Walk v2c/v3 retornam valores, distinguem timeout/auth/protocol e respeitam limites.
- **CA-002:** range discovery/polling tem concorrência, jitter, allowlist e proteção contra ranges excessivos.

### RF-002 — Credenciais seguras
- **CA-003:** segredo central usa envelope autenticado/rotação e cache local protegido; nunca aparece em API/log.

### RF-003 — Assets de rede
- **CA-004:** dispositivos/interfaces são identificados sem duplicação e métricas MIB-II chegam a current/history/events.

### RF-004 — Hyper-V
- **CA-005:** host, VMs e volumes virtuais têm identidade estável, inventário e métricas; ausência de Hyper-V não quebra agente comum.

### RF-005 — Portal e operação
- **CA-006:** telas Rede/Servidores distinguem host/VM/dispositivo, com estados, detalhe e histórico reais.
- **CA-007:** testes usam simulador SNMP e host Hyper-V controlado; limitações ficam documentadas.

## Restrições

- SharpSnmpClient atual é stub e não conta como implementado.
- Segredos SNMP exigem revisão de segurança antes de uso real.

## Riscos

- SNMP pode causar varredura indevida se ranges não forem validados.
- WMI/CIM Hyper-V exige privilégios e varia por Windows Server.
