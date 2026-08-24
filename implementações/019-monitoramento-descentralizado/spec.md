---
id: "019"
title: "Monitoramento descentralizado — Agente Host + Coletor SNMP"
status: in_progress
priority: high
risk: high
created_at: 2026-08-01
updated_at: 2026-08-23
depends_on: ["010"]
requirements: [RF-NEW-01, RF-NEW-02, RF-NEW-03, RF-NEW-04, RF-NEW-05, RF-NEW-06, RF-NEW-07, RF-NEW-08]
implemented: [T-019-001, T-019-003, T-019-004, T-019-005, T-019-006, T-019-007, T-019-008, T-019-009, T-019-010, T-019-011]
---

# Especificação

## Objetivo e escopo

Substituir a integração Zabbix (impl. 013) por duas abordagens descentralizadas:

1. **Agente de Host (Windows)**: Script PowerShell executado no servidor host do cliente, que coleta métricas do host físico e das VMs via Hyper-V WMI, enviando ao portal via HTTPS.

2. **Coletor SNMP (Windows)**: Executável/serviço Windows que executa no servidor do cliente, descobrindo e monitorando dispositivos de rede via SNMP v2c/v1.

## Fora de escopo

- Agente Linux ou outras plataformas que não Windows
- SNMP v3
- Comandos remotos ao agente
- Auto-update do agente
- Monitoramento de aplicações (DB, web server)
- Suporte a ambientes cloud (AWS, Azure)
- Integração com Zabbix (descontinuado)

## Requisitos e critérios

- **RF-NEW-01:** Agente Windows registra e reporta métricas do host a cada 60s
- **RF-NEW-02:** Agente detecta e reporta métricas de VMs via Hyper-V WMI
- **RF-NEW-03:** Coletor SNMP descobre dispositivos em range IP configurado
- **RF-NEW-04:** Coletor suporta SNMP v2c com fallback v1
- **RF-NEW-05:**heartbeat a cada 5min para detecção de offline
- **RF-NEW-06:** Eventos gerados para mudanças de estado (online/offline)
- **RF-NEW-07:** API com autenticação via company token
- **RF-NEW-08:** Interface admin para gerenciar agentes e coletores

## Requisitos do PRD afetados

A desativação do Zabbix impacta:
- RF-020 a RF-029 (Zabbix, servidores e rede) — **substituídos**
- Cockpit (RF-030 a RF-036) — consumirá dados das novas fontes
- Dashboard — ajustará para ler novas tabelas

## Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│  SERVIDOR HOST DO CLIENTE (Windows)                          │
│                                                              │
│  ┌──────────────┐    ┌──────────────────┐                  │
│  │    AGENTE    │    │  COLETOR SNMP     │                  │
│  │  PowerShell  │    │  .exe / Serviço   │                  │
│  │              │    │                  │                  │
│  │  Hyper-V WMI │    │  v2c / v1        │                  │
│  │  CPU/RAM/VM  │    │  Discovery       │                  │
│  └──────┬───────┘    └────────┬─────────┘                  │
│         │                      │                             │
│         └──────────┬───────────┘                             │
│                    │ HTTPS POST                               │
└────────────────────┼─────────────────────────────────────────┘
                     │
                     ▼
          ┌─────────────────────┐
          │   BACKEND PORTAL     │
          │   Fastify + Supabase │
          └─────────────────────┘
```

## Mapeamento de dados

| Origem | Destino | Campos |
|--------|---------|--------|
| Agente → Host | `servers` | hostname, ip, cpu%, mem%, disk% |
| Agente → VMs | `servers` (com vm_parent_id) | hostname, cpu%, mem%, disk%, parent |
| Agente → host_metrics | `agent_metrics` | cpu, mem, disk, vms_json |
| Coletor SNMP | `network_devices` | device_name, ip, status, device_type |
| Agente | `agent_registrations` | hostname, version, hypervisor, last_seen |

## Restrições e riscos

- Hyper-V WMI requer PowerShell 5.1+ e permissões de admin
- SNMP pode estar bloqueado por firewall em alguns devices
- Community strings em texto (MVP) — migrar para cofre após impl. 018
