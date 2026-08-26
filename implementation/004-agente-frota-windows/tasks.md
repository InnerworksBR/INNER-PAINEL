# Tarefas

- [ ] **T-001:** Consolidar estado/versão do agente e contrato de compatibilidade com API.
  - **Cobre:** RF-003, RF-005, RF-006
  - **Valida:** CA-005, CA-009, CA-011
  - **Testes:** CT-001 versão suportada/antiga/nova
  - **Arquivos esperados:** csproj, contracts, bootstrap/manifest
  - **Dependências:** contrato de 001
  - **Risco:** medium
  - **Critério de conclusão:** versão não é hardcoded em múltiplos pontos e API informa incompatibilidade.

- [ ] **T-002:** Completar renovação proativa e retry único após 401.
  - **Cobre:** RF-001
  - **Valida:** CA-001, CA-002
  - **Testes:** CT-002 expirado, próximo, refresh rotacionado, 401 repetido
  - **Arquivos esperados:** EnrollmentService, transport
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** agente recupera autorização sem intervenção e sem loop.

- [ ] **T-003:** Centralizar HttpClient, timeouts, classificação de resposta e redaction.
  - **Cobre:** RF-001, RF-002
  - **Valida:** CA-002, CA-004
  - **Testes:** CT-003 timeout, disconnect, 400/401/429/500
  - **Arquivos esperados:** services/transport e DI
  - **Dependências:** T-002
  - **Risco:** medium
  - **Critério de conclusão:** conexões são reutilizadas e logs têm status/correlation sem segredo.

- [ ] **T-004:** Evoluir outbox para attempts, next attempt, quarantine e limite.
  - **Cobre:** RF-002
  - **Valida:** CA-003, CA-004
  - **Testes:** CT-004 reboot, backoff, disk cap, poison batch
  - **Arquivos esperados:** SqliteOutbox, migration local, IOutbox
  - **Dependências:** T-003
  - **Risco:** high
  - **Critério de conclusão:** nenhum batch é perdido e fila não cresce sem limite.

- [ ] **T-005:** Corrigir heartbeat para usar estado e sequências reais.
  - **Cobre:** RF-003
  - **Valida:** CA-005
  - **Testes:** CT-005 ciclo ok/falha, backlog e last sequence
  - **Arquivos esperados:** AgentWorker, HeartbeatService
  - **Dependências:** T-004
  - **Risco:** medium
  - **Critério de conclusão:** portal/API refletem o estado local verdadeiro.

- [ ] **T-006:** Ligar cache/fetch periódico de configuração ao loop.
  - **Cobre:** RF-003
  - **Valida:** CA-006
  - **Testes:** CT-006 startup offline, ETag, config inválida e rollback
  - **Arquivos esperados:** AgentWorker, ConfigurationService
  - **Dependências:** T-003
  - **Risco:** medium
  - **Critério de conclusão:** intervalos e collectors mudam sem reinstalação.

- [ ] **T-007:** Completar protocolo e polling de comandos com auditoria/idempotência.
  - **Cobre:** RF-003
  - **Valida:** CA-006
  - **Testes:** CT-007 lease, duplicate, timeout, complete/fail
  - **Arquivos esperados:** AgentWorker, CommandExecutor, Cloud API/controllers/domain
  - **Dependências:** T-003, T-006
  - **Risco:** high
  - **Critério de conclusão:** comando não executa duas vezes e resultado chega ao servidor.

- [ ] **T-008:** Tornar instalador install/upgrade/repair/uninstall idempotente e auto-start correto.
  - **Cobre:** RF-004
  - **Valida:** CA-007, CA-008
  - **Testes:** CT-008 matriz serviço ausente/parado/rodando/1072/reboot
  - **Arquivos esperados:** install-agent.ps1, uninstall
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** upgrade preserva dados e restaura o estado Running automaticamente.

- [ ] **T-009:** Endurecer ACL/DPAPI e remoção do token de ativação.
  - **Cobre:** RF-001, RF-004
  - **Valida:** CA-002, CA-008
  - **Testes:** CT-009 usuário comum não lê secrets; restart consegue ler
  - **Arquivos esperados:** SecureStorage, installer
  - **Dependências:** T-008
  - **Risco:** high
  - **Critério de conclusão:** segredo não fica em pacote/log/config plaintext após enrollment.

- [ ] **T-010:** Criar pipeline de pacote versionado, checksum, assinatura e rollback.
  - **Cobre:** RF-005
  - **Valida:** CA-009
  - **Testes:** CT-010 build reproduzível, hash e pacote anterior
  - **Arquivos esperados:** scripts/publish, artifacts manifest, release docs
  - **Dependências:** T-001–T-009
  - **Risco:** medium
  - **Critério de conclusão:** cada artefato é rastreável a commit e verificável antes de instalar.

- [ ] **T-011:** Criar instalação silenciosa e runbook de distribuição por endpoint.
  - **Cobre:** RF-005, RF-006
  - **Valida:** CA-010, CA-011
  - **Testes:** CT-011 exit codes e execução remota não interativa
  - **Arquivos esperados:** installer, docs/agent deployment
  - **Dependências:** T-008, T-010; integração 003 para tokens
  - **Risco:** medium
  - **Critério de conclusão:** suporte instala em lote sem compartilhar token entre máquinas.

- [ ] **T-012:** Executar matriz de resiliência Windows e documentar suporte.
  - **Cobre:** RF-001–RF-006
  - **Valida:** CA-001–CA-012
  - **Testes:** CT-012 1 h offline, reboot, token expirado, upgrade, API reiniciada
  - **Arquivos esperados:** testes/runbook/validation
  - **Dependências:** T-001–T-011
  - **Risco:** high
  - **Critério de conclusão:** backlog é enviado após recuperação e serviço permanece Running.
