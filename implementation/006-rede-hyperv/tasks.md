# Tarefas

- [ ] **T-001:** Implementar Get/Walk SNMP v2c e v3 no adapter real.
  - **Cobre:** RF-001
  - **Valida:** CA-001
  - **Testes:** CT-001 simulador v2c/v3 e erros
  - **Arquivos esperados:** SharpSnmpClient, ISnmpClient
  - **Dependências:** nenhuma
  - **Risco:** high
  - **Critério de conclusão:** métodos não retornam listas vazias por stub.

- [ ] **T-002:** Endurecer range planner, discovery, polling e limites.
  - **Cobre:** RF-001
  - **Valida:** CA-002
  - **Testes:** CT-002 CIDR inválido/grande, cancelamento e concorrência
  - **Arquivos esperados:** Discovery/Polling/Concurrency
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** somente ranges autorizados são sondados com orçamento controlado.

- [ ] **T-003:** Completar envelope, rotação e cache de credenciais SNMP.
  - **Cobre:** RF-002
  - **Valida:** CA-003
  - **Testes:** CT-003 encrypt/decrypt/rotate/redaction/ACL
  - **Arquivos esperados:** Infrastructure.Security, CredentialManager, API
  - **Dependências:** revisão de segurança
  - **Risco:** critical
  - **Critério de conclusão:** plaintext não persiste nem aparece em logs/respostas.

- [ ] **T-004:** Integrar enrollment/outbox/config do Edge Collector.
  - **Cobre:** RF-001–RF-003
  - **Valida:** CA-001–CA-004
  - **Testes:** CT-004 offline/retry/config/credential version
  - **Arquivos esperados:** Edge hosted service e transport
  - **Dependências:** T-001–T-003; 004
  - **Risco:** high
  - **Critério de conclusão:** coletor usa o mesmo pipeline durável do agente.

- [ ] **T-005:** Processar identidade/métricas de dispositivos e interfaces.
  - **Cobre:** RF-003
  - **Valida:** CA-004
  - **Testes:** CT-005 rediscovery, troca IP e interface
  - **Arquivos esperados:** Worker/Application/Domain
  - **Dependências:** T-004; 001
  - **Risco:** high
  - **Critério de conclusão:** rediscovery não duplica dispositivo e history é consultável.

- [ ] **T-006:** Ligar HyperVCollector ao Agent com capability/config.
  - **Cobre:** RF-004
  - **Valida:** CA-005
  - **Testes:** CT-006 host sem/com Hyper-V e permissões
  - **Arquivos esperados:** Agent registry, HyperV collector
  - **Dependências:** 004
  - **Risco:** high
  - **Critério de conclusão:** agente comum não falha e host Hyper-V emite inventário válido.

- [ ] **T-007:** Resolver identidade e métricas de VMs/discos virtuais.
  - **Cobre:** RF-004
  - **Valida:** CA-005
  - **Testes:** CT-007 rename/restart/move/state
  - **Arquivos esperados:** Worker processing/contracts
  - **Dependências:** T-006; 001
  - **Risco:** high
  - **Critério de conclusão:** VM mantém identidade ao renomear/reiniciar.

- [ ] **T-008:** Conectar API/portal para rede, Hyper-V e VMs.
  - **Cobre:** RF-005
  - **Valida:** CA-006
  - **Testes:** CT-008 lista/detalhe/history/tenant
  - **Arquivos esperados:** API, BFF e web Rede/Servidores
  - **Dependências:** T-005, T-007; 002/003
  - **Risco:** medium
  - **Critério de conclusão:** dados não vêm mais do fluxo Zabbix para esses assets.

- [ ] **T-009:** Executar testes E2E, segurança e piloto autorizado.
  - **Cobre:** RF-001–RF-005
  - **Valida:** CA-001–CA-007
  - **Testes:** CT-009 SNMP/Hyper-V ponta a ponta
  - **Arquivos esperados:** tests/validation/runbook
  - **Dependências:** T-001–T-008
  - **Risco:** high
  - **Critério de conclusão:** limitações e cobertura são comprovadas, não apenas documentadas.
