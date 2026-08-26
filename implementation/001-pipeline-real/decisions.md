# Decisões

## D-001 — PostgreSQL do Monitoring como fonte de verdade

**Status:** proposta para aprovação.  
O Worker persiste o modelo operacional no schema `monitoring`; o portal lê por API. Não haverá dual-write para a tabela `servers` do Supabase.

## D-002 — Identidade única do host

**Status:** proposta para aprovação.  
CPU, memória, uptime, sistema e discos pertencem ao asset canônico `host`. Volumes são representados por dimensões e detalhes do host no MVP; assets-filho só serão criados se uma necessidade de inventário exigir.

## D-003 — Processamento pelo menos uma vez e persistência idempotente

**Status:** proposta para aprovação.  
`batch_id`, `record_id`, asset identifiers e metric dimension hash formam as barreiras de deduplicação. ACK de ingestão não significa processamento concluído.

## D-004 — Não corrigir batches por exclusão

**Status:** proposta para aprovação.  
Backfill/replay preservará payload e auditoria; nenhum batch de produção será apagado para “destravar” o sistema.
