---
id: "002"
title: "API de consulta tenant-safe e contratos do portal"
status: planned
priority: critical
risk: high
created_at: 2026-08-26
updated_at: 2026-08-26
owner: ai-agent
depends_on: ["001"]
requirements: [RF-001, RF-002, RF-003, RF-004, RF-005]
---
# Especificação

## Objetivo e escopo

Entregar contratos estáveis para o portal listar servidores, consultar detalhe e histórico, mostrar sources/agentes e resumir saúde, sempre isolando dados por empresa e sem expor o banco do Monitoring ao frontend.

## Fora de escopo

- Componentes React e layout.
- Processamento do batch, coberto por `001`.
- Escrita em Supabase para compatibilidade.

## Requisitos e critérios

### RF-001 — Isolamento por empresa

- **CA-001:** company scope vem do JWT validado; usuário comum nunca troca de empresa por parâmetro.
- **CA-002:** platform admin pode consultar empresa selecionada, com auditoria e testes cross-tenant negativos.

### RF-002 — Lista operacional de servidores

- **CA-003:** a lista retorna hostname, estado, last seen, versão/source e métricas compactas de CPU, memória e discos sem N+1.
- **CA-004:** filtros, paginação, busca e ordenação são determinísticos.

### RF-003 — Detalhe e histórico

- **CA-005:** detalhe retorna inventário, volumes, métricas atuais, eventos e identidade.
- **CA-006:** histórico aceita janela, metric keys e resolução, com limites contra consultas excessivas.

### RF-004 — Resumo da frota

- **CA-007:** endpoints retornam total, online/stale/offline, última coleta, última ingestão, versão e backlog relevante.
- **CA-008:** source registrada sem asset processado aparece como “aguardando primeira coleta”, não desaparece.

### RF-005 — Contrato e segurança de integração

- **CA-009:** OpenAPI/DTOs e cliente TypeScript concordam em nomes, nullability e erros.
- **CA-010:** tokens do portal e dos agentes têm escopo/validação separados; CORS público não é necessário para consultas via BFF.

## Restrições

- Acesso do browser ocorre pelo backend Fastify.
- Respostas não expõem tokens, hashes, payload bruto ou detalhes internos de falha.
- Paginação máxima e timeouts obrigatórios.

## Riscos

- `AssetQueryService` atual retorna vazio porque não recebe company ID.
- `AssetSummary` atual não contém as métricas necessárias à tela.
- SSE via `EventSource` não suporta header Authorization padrão; polling será o MVP.
