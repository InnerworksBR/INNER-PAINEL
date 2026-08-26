---
id: "003"
title: "Integração do Monitoring com o portal"
status: planned
priority: critical
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["002"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005]
---
# Especificação

## Objetivo e escopo

Conectar o Fastify e as telas React à Monitoring API para que cliente e administrador vejam a frota real, removendo valores estáticos e a dependência da tabela Supabase `servers` para agentes nativos.

## Fora de escopo

- Alterar o pipeline de ingestão.
- Expor credenciais/tokens ao frontend.
- Redesenhar todo o portal fora das páginas afetadas.

## Requisitos e critérios

### RF-001 — BFF autenticado

- **CA-001:** rotas de cliente usam a empresa do usuário; admin usa empresa selecionada e auditada.
- **CA-002:** falha/timeout da Monitoring API vira erro sanitizado e observável, sem quebrar autenticação do portal.

### RF-002 — Tela Servidores

- **CA-003:** todas as máquinas com agente e primeira coleta aparecem com hostname, online/stale/offline, CPU, memória, discos, versão e last seen.
- **CA-004:** source registrada sem dados aparece como aguardando; estados vazio, loading, erro e retry são claros.

### RF-003 — Detalhe e histórico

- **CA-005:** seleção mostra inventário/volumes/métricas e gráficos reais na janela escolhida.
- **CA-006:** auto-refresh não perde seleção nem dispara requests duplicadas.

### RF-004 — Administração da frota

- **CA-007:** cartão da empresa mostra total, online/offline, última sync, erro e versões reais.
- **CA-008:** admin consegue gerar token por máquina, copiar comando e consultar agentes registrados sem revelar tokens usados.

### RF-005 — Migração segura

- **CA-009:** feature flag permite alternar leitura Supabase/Monitoring durante piloto.
- **CA-010:** dashboard geral usa a mesma fonte e não apresenta contagens divergentes.

## Restrições

- O frontend só chama `/api/...` do portal.
- Token de ativação continua uso único; uma máquina exige um token próprio.
- Compatibilidade mobile/responsiva e acessibilidade básica são obrigatórias.

## Riscos

- O hook de realtime atual foi desenhado para Supabase/polling e pode esconder erros.
- Tela possui variável `events` não usada e lint falhando.
- Dashboard e Servidores podem divergir se migrados em momentos diferentes.
