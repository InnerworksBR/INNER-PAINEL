# Tarefas

- [ ] **T-001:** Definir e versionar o contrato canônico de host, métricas e volumes.
  - **Cobre:** RF-002, RF-003
  - **Valida:** CA-003, CA-004, CA-005
  - **Testes:** CT-001 fixtures de serialização e identidade
  - **Arquivos esperados:** Contracts, collectors, documentação de contrato
  - **Dependências:** nenhuma
  - **Risco:** high
  - **Critério de conclusão:** todos os registros de uma máquina resolvem o mesmo host; volumes são dimensões/filhos conforme decisão registrada.

- [ ] **T-002:** Implementar parser e validação de schema/record type/value type.
  - **Cobre:** RF-001, RF-003
  - **Valida:** CA-001, CA-005
  - **Testes:** CT-002 payload válido, inválido, desconhecido e limite
  - **Arquivos esperados:** Application/Processing
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** payload inválido falha com código estável sem persistência parcial.

- [ ] **T-003:** Implementar resolução idempotente de asset, identifiers e source binding.
  - **Cobre:** RF-002
  - **Valida:** CA-003, CA-004
  - **Testes:** CT-003 hostname/fingerprint iguais, conflito e rename
  - **Arquivos esperados:** Application, Domain, Infrastructure.Postgres
  - **Dependências:** T-001, T-002
  - **Risco:** high
  - **Critério de conclusão:** uma máquina não gera assets duplicados e conflitos ficam auditáveis.

- [ ] **T-004:** Persistir inventário, metric samples e metric current com deduplicação.
  - **Cobre:** RF-001, RF-003
  - **Valida:** CA-001, CA-005, CA-006
  - **Testes:** CT-004 replay de batch/record e múltiplas dimensões de disco
  - **Arquivos esperados:** Processing service, DbContext, repositories
  - **Dependências:** T-002, T-003
  - **Risco:** high
  - **Critério de conclusão:** current reflete a amostra mais recente e history não duplica replay.

- [ ] **T-005:** Atualizar estado, freshness, eventos e stream events.
  - **Cobre:** RF-005
  - **Valida:** CA-009, CA-010
  - **Testes:** CT-005 online→stale→offline→online
  - **Arquivos esperados:** Processing/state evaluator
  - **Dependências:** T-003, T-004
  - **Risco:** medium
  - **Critério de conclusão:** transições são consistentes e eventos não se repetem sem mudança.

- [ ] **T-006:** Corrigir claim transacional, lease configurável, retry e dead letter.
  - **Cobre:** RF-001, RF-004
  - **Valida:** CA-002, CA-007, CA-008
  - **Testes:** CT-006 duas réplicas, crash e lease expirado
  - **Arquivos esperados:** Cloud.Worker, repositories
  - **Dependências:** T-002
  - **Risco:** critical
  - **Critério de conclusão:** não há processamento concorrente duplicado nem job perdido.

- [ ] **T-007:** Criar/ajustar catálogo de métricas e mappings com unidades.
  - **Cobre:** RF-003
  - **Valida:** CA-005
  - **Testes:** CT-007 todas as metric keys do agente resolvem definição ativa
  - **Arquivos esperados:** MetricCatalogSeed, migration
  - **Dependências:** T-001
  - **Risco:** medium
  - **Critério de conclusão:** nenhuma métrica conhecida é descartada ou exibida apenas por ID numérico.

- [ ] **T-008:** Criar migrations aditivas, constraints e índices de hot path.
  - **Cobre:** RF-003, RF-004, RF-006
  - **Valida:** CA-006, CA-007, CA-012
  - **Testes:** CT-008 migration up em banco vazio e banco existente
  - **Arquivos esperados:** EF migrations e SQL espelho
  - **Dependências:** T-003, T-004, T-006, T-007
  - **Risco:** high
  - **Critério de conclusão:** migration aplica sem perda e queries críticas usam índices esperados.

- [ ] **T-009:** Preparar inventário e replay dos batches existentes.
  - **Cobre:** RF-006
  - **Valida:** CA-011
  - **Testes:** CT-009 dry-run e contagens antes/depois
  - **Arquivos esperados:** script/runbook versionado, sem secrets
  - **Dependências:** T-004, T-008
  - **Risco:** high
  - **Critério de conclusão:** plano identifica pendentes, simulados e duplicados sem apagar evidência.

- [ ] **T-010:** Criar suíte E2E do pipeline com PostgreSQL real.
  - **Cobre:** RF-001–RF-006
  - **Valida:** CA-001–CA-012
  - **Testes:** CT-010 registro→batch→worker→asset/state/metrics/events
  - **Arquivos esperados:** IntegrationTests
  - **Dependências:** T-001–T-009
  - **Risco:** high
  - **Critério de conclusão:** teste não-placeholder passa e prova o fluxo completo.
