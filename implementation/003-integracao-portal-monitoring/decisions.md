# Decisões

## D-001 — Sem sincronização Monitoring → Supabase

**Status:** proposta para aprovação.  
O Fastify adapta a Monitoring API para o portal. Evita duplicação, atraso e reconciliação entre dois bancos.

## D-002 — Compatibilidade temporária por feature flag

**Status:** proposta para aprovação.  
O fallback Supabase existe apenas durante piloto, com data/critério de remoção na tarefa T-010.

## D-003 — Um token de ativação por máquina

**Status:** proposta para aprovação.  
Tokens permanecem uso único. Distribuição em massa gera múltiplos tokens ou usa automação autorizada; um token compartilhado por frota não será criado.

## D-004 — Estados explícitos

**Status:** proposta para aprovação.  
Source registrada, aguardando primeira coleta, online, stale, offline e erro são estados distintos no portal.
