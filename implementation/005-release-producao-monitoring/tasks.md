# Tarefas

- [ ] **T-001:** Definir matriz de gates e corrigir baseline afetada.
  - **Cobre:** RF-001
  - **Valida:** CA-001
  - **Testes:** CT-001 dotnet/backend/web build-test-lint-typecheck
  - **Arquivos esperados:** testes/configs afetados
  - **Dependências:** 001–004 prontas
  - **Risco:** high
  - **Critério de conclusão:** nenhum gate vermelho é ignorado ou mascarado por placeholder.

- [ ] **T-002:** Executar revisões independentes de código, segurança, banco e performance.
  - **Cobre:** RF-001–RF-004
  - **Valida:** CA-001–CA-008
  - **Testes:** CT-002 findings high/critical fechados
  - **Arquivos esperados:** reviews/
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** nenhum finding bloqueador permanece aberto.

- [ ] **T-003:** Preparar backup/restore, migration dry-run e inventário de dados.
  - **Cobre:** RF-002
  - **Valida:** CA-003, CA-004
  - **Testes:** CT-003 restore em banco isolado e migration duas vezes
  - **Arquivos esperados:** runbook e evidências sanitizadas
  - **Dependências:** implementation 001
  - **Risco:** critical
  - **Critério de conclusão:** RPO/RTO e comandos de rollback estão comprovados.

- [ ] **T-004:** Validar imagens Docker e configurações EasyPanel sem secrets no código.
  - **Cobre:** RF-003
  - **Valida:** CA-005, CA-006
  - **Testes:** CT-004 Docker build/run/health API e execução Worker
  - **Arquivos esperados:** Dockerfile.Api, Dockerfile.Worker, deploy docs
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** mesmas imagens rodam localmente e no plano de produção.

- [ ] **T-005:** Implementar sinais operacionais e alertas mínimos.
  - **Cobre:** RF-004
  - **Valida:** CA-007, CA-008
  - **Testes:** CT-005 simulação API down, worker down, lag, dead letter, source offline
  - **Arquivos esperados:** health/logging/operations docs
  - **Dependências:** implementation 001/002
  - **Risco:** high
  - **Critério de conclusão:** falhas críticas geram sinal acionável com correlation ID.

- [ ] **T-006:** Criar suíte E2E e dados de duas empresas.
  - **Cobre:** RF-001, RF-005
  - **Valida:** CA-002, CA-009
  - **Testes:** CT-006 agente→portal e cross-tenant negativo
  - **Arquivos esperados:** integration/e2e tests
  - **Dependências:** 001–004
  - **Risco:** critical
  - **Critério de conclusão:** fluxo real passa sem fixture manual no banco.

- [ ] **T-007:** Preparar release notes, versões, checksums e commits alvo.
  - **Cobre:** RF-003, RF-006
  - **Valida:** CA-005, CA-011
  - **Testes:** CT-007 artefato ↔ commit e manifest
  - **Arquivos esperados:** release checklist/manifest
  - **Dependências:** T-001–T-006
  - **Risco:** medium
  - **Critério de conclusão:** cada componente tem versão e rollback identificados.

- [ ] **T-008:** Executar migration e deploy controlado no EasyPanel.
  - **Cobre:** RF-002, RF-003
  - **Valida:** CA-003–CA-006
  - **Testes:** CT-008 health/smoke/containers/commit após cada etapa
  - **Arquivos esperados:** evidência operacional
  - **Dependências:** T-003, T-004, T-007; aprovação imediata
  - **Risco:** critical
  - **Critério de conclusão:** API/Worker/backend/web estão saudáveis nos commits aprovados.

- [ ] **T-009:** Pilotar empresa e agente reais com critérios de parada.
  - **Cobre:** RF-005
  - **Valida:** CA-009, CA-010
  - **Testes:** CT-009 backlog, histórico, restart e offline/recovery
  - **Arquivos esperados:** validation/evidências
  - **Dependências:** T-006, T-008; aprovação do piloto
  - **Risco:** critical
  - **Critério de conclusão:** máquina aparece no portal por 24 h sem perda/erro bloqueador.

- [ ] **T-010:** Ampliar rollout 5%→25%→100% e acompanhar.
  - **Cobre:** RF-005
  - **Valida:** CA-010
  - **Testes:** CT-010 sinais e critérios em cada onda
  - **Arquivos esperados:** rollout log
  - **Dependências:** T-009; aprovações por onda
  - **Risco:** high
  - **Critério de conclusão:** frota alvo cadastrada e saudável, sem lag/dead letter anormal.

- [ ] **T-011:** Atualizar documentação e runbooks divergentes.
  - **Cobre:** RF-006
  - **Valida:** CA-011
  - **Testes:** CT-011 comandos/URLs executáveis contra ambiente
  - **Arquivos esperados:** monitoring/docs, docs/monitoring, README
  - **Dependências:** T-008–T-010
  - **Risco:** medium
  - **Critério de conclusão:** suporte não encontra .NET/rotas/plataforma conflitantes.

- [ ] **T-012:** Emitir validação final e matriz requisito→evidência.
  - **Cobre:** RF-001–RF-006
  - **Valida:** CA-001–CA-012
  - **Testes:** CT-012 auditoria de convergência
  - **Arquivos esperados:** validation.md e reviews/
  - **Dependências:** T-001–T-011
  - **Risco:** high
  - **Critério de conclusão:** nenhuma tarefa P0 aberta e riscos residuais aprovados.
