# Decisões

## D-001 — Capacidades avançadas desligadas por padrão

**Status:** proposta para aprovação.  
Rollup/retention/alerts/commands/updates só são habilitados após teste e observabilidade específicos.

## D-002 — Sem shell remota genérica

**Status:** obrigatória.  
Comandos são tipos allowlisted com parâmetros validados, timeout e auditoria.

## D-003 — Retenção por partição

**Status:** proposta para aprovação.  
Dados volumosos usam manutenção de partitions em vez de deletes massivos; dry-run/backup precedem qualquer remoção.
