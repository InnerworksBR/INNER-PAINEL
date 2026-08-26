# Tarefas

- [ ] **T-001:** Implementar heartbeat/health operacional do Worker e manutenção.
  - **Cobre:** RF-005
  - **Valida:** CA-006
  - **Testes:** CT-001 worker down/stale/lag
  - **Arquivos esperados:** Cloud.Worker, Platform health
  - **Dependências:** 005
  - **Risco:** high
  - **Critério de conclusão:** ausência do Worker é detectada sem depender de inspeção manual Docker.

- [ ] **T-002:** Completar e agendar rollups 5m/1h idempotentes.
  - **Cobre:** RF-001
  - **Valida:** CA-001
  - **Testes:** CT-002 golden dataset, atraso e replay
  - **Arquivos esperados:** RollupService, Worker
  - **Dependências:** 001
  - **Risco:** high
  - **Critério de conclusão:** agregados batem com samples e podem ser recalculados.

- [ ] **T-003:** Completar retenção/partitions com dry-run e orçamento de lock.
  - **Cobre:** RF-001
  - **Valida:** CA-002
  - **Testes:** CT-003 partição antiga/ativa, cancelamento e restore
  - **Arquivos esperados:** RetentionService, migrations/runbook
  - **Dependências:** T-002; backup aprovado
  - **Risco:** critical
  - **Critério de conclusão:** somente dados elegíveis são removidos com evidência.

- [ ] **T-004:** Implementar state machine de alertas e regras padrão.
  - **Cobre:** RF-002
  - **Valida:** CA-003
  - **Testes:** CT-004 open/dedupe/resolve/flapping
  - **Arquivos esperados:** AlertEvaluator, Worker, events
  - **Dependências:** 001, T-001
  - **Risco:** high
  - **Critério de conclusão:** um incidente gera um evento ativo e resolução correspondente.

- [ ] **T-005:** Completar endpoints e ciclo durável de comandos allowlisted.
  - **Cobre:** RF-003
  - **Valida:** CA-004
  - **Testes:** CT-005 auth, lease, replay, timeout e audit
  - **Arquivos esperados:** API/Domain/Agent Commands
  - **Dependências:** 004
  - **Risco:** critical
  - **Critério de conclusão:** nenhuma entrada executa shell arbitrária e toda ação é auditável.

- [ ] **T-006:** Completar update assinado, canário e rollback.
  - **Cobre:** RF-004
  - **Valida:** CA-005
  - **Testes:** CT-006 assinatura inválida, download parcial, rollback
  - **Arquivos esperados:** SignedUpdateService, agent updater, release pipeline
  - **Dependências:** 004/005, security review
  - **Risco:** critical
  - **Critério de conclusão:** artefato não assinado nunca é executado e downgrade preserva dados.

- [ ] **T-007:** Transformar Diagnostics CLI em ferramenta operacional real e sanitizada.
  - **Cobre:** RF-005
  - **Valida:** CA-007
  - **Testes:** CT-007 comandos read-only e redaction
  - **Arquivos esperados:** Diagnostics.Cli, operations docs
  - **Dependências:** T-001–T-006
  - **Risco:** medium
  - **Critério de conclusão:** projeto deixa de ser `Class1` vazio e produz diagnóstico reproduzível.

- [ ] **T-008:** Executar carga/chaos e emitir aceite das capacidades avançadas.
  - **Cobre:** RF-001–RF-005
  - **Valida:** CA-001–CA-007
  - **Testes:** CT-008 volume, crash, backlog, rollup/retention/alert/command/update
  - **Arquivos esperados:** performance/validation/reviews
  - **Dependências:** T-001–T-007
  - **Risco:** high
  - **Critério de conclusão:** limites e riscos residuais estão medidos e aprovados.
