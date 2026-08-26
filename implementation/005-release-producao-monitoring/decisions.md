# Decisões

## D-001 — Ordem de rollout

**Status:** proposta para aprovação.  
Migration → API → Worker → backend → web → feature flag piloto → agentes. O Worker nunca é ativado antes do schema e do processamento real.

## D-002 — Piloto obrigatório

**Status:** proposta para aprovação.  
Uma empresa/máquina permanece observada por 24 horas antes da expansão; uma segunda empresa valida isolamento.

## D-003 — Worker sem container bloqueia release

**Status:** aprovado por evidência técnica.  
Configuração no EasyPanel não equivale a execução. Container ativo, logs e redução de backlog são critérios obrigatórios.

## D-004 — Deploy sempre com aprovação imediata

**Status:** obrigatório.  
Planejamento e aprovações anteriores não autorizam migration, deploy, restart, flag ou rollback futuros.
