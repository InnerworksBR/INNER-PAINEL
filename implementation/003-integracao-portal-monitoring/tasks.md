# Tarefas

- [ ] **T-001:** Criar helper único de token de ponte e cliente Monitoring com timeout/correlation ID.
  - **Cobre:** RF-001
  - **Valida:** CA-001, CA-002
  - **Testes:** CT-001 escopo, timeout, 401/403/5xx
  - **Arquivos esperados:** backend services/plugins
  - **Dependências:** implementação 002
  - **Risco:** high
  - **Critério de conclusão:** nenhuma rota duplica lógica JWT nem vaza resposta interna.

- [ ] **T-002:** Implementar BFF de lista, detalhe, histórico, eventos e resumo.
  - **Cobre:** RF-001–RF-004
  - **Valida:** CA-001–CA-008
  - **Testes:** CT-002 contrato de cada rota
  - **Arquivos esperados:** backend routes, app.ts
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** cliente/admin acessam somente dados da empresa autorizada.

- [ ] **T-003:** Introduzir feature flag e adaptador compatível com `/client/metrics/servers`.
  - **Cobre:** RF-005
  - **Valida:** CA-009
  - **Testes:** CT-003 monitoring, fallback e erro
  - **Arquivos esperados:** metrics routes/config docs
  - **Dependências:** T-002
  - **Risco:** medium
  - **Critério de conclusão:** alternância é explícita, observável e reversível.

- [ ] **T-004:** Alimentar lista de Servidores com modelo real e todos os estados visuais.
  - **Cobre:** RF-002
  - **Valida:** CA-003, CA-004
  - **Testes:** CT-004 data/loading/empty/error/awaiting
  - **Arquivos esperados:** servidores.jsx e componentes
  - **Dependências:** T-003
  - **Risco:** high
  - **Critério de conclusão:** máquina piloto aparece e status não depende de dados Supabase.

- [ ] **T-005:** Implementar detalhe, volumes, métricas atuais e gráficos históricos.
  - **Cobre:** RF-003
  - **Valida:** CA-005, CA-006
  - **Testes:** CT-005 seleção, refresh, janela e ausência de série
  - **Arquivos esperados:** Servidores, drawer/hooks/charts
  - **Dependências:** T-004
  - **Risco:** medium
  - **Critério de conclusão:** gráficos representam valores/horários retornados pela API.

- [ ] **T-006:** Trocar cartão administrativo estático por status real e lista de agentes.
  - **Cobre:** RF-004
  - **Valida:** CA-007, CA-008
  - **Testes:** CT-006 zero/um/múltiplos/offline/erro
  - **Arquivos esperados:** empresasAdmin.jsx, admin monitoring routes
  - **Dependências:** T-002
  - **Risco:** high
  - **Critério de conclusão:** `Nunca/0` só aparece quando verdadeiro.

- [ ] **T-007:** Melhorar fluxo de token/instalação por máquina e instruções copiáveis.
  - **Cobre:** RF-004
  - **Valida:** CA-008
  - **Testes:** CT-007 criação, uso único, expiração e token oculto após uso
  - **Arquivos esperados:** admin UI/routes
  - **Dependências:** T-006; implementação 004 define comando
  - **Risco:** medium
  - **Critério de conclusão:** admin entende que cada endpoint requer token próprio.

- [ ] **T-008:** Migrar dashboard e contagens para o mesmo resumo Monitoring.
  - **Cobre:** RF-005
  - **Valida:** CA-010
  - **Testes:** CT-008 contagens iguais em dashboard/servidores/admin
  - **Arquivos esperados:** client/admin dashboard routes e pages
  - **Dependências:** T-002, T-004, T-006
  - **Risco:** medium
  - **Critério de conclusão:** não há números conflitantes para a mesma empresa.

- [ ] **T-009:** Cobrir responsividade, acessibilidade e erros de lint específicos do fluxo.
  - **Cobre:** RF-002–RF-004
  - **Valida:** CA-003–CA-008
  - **Testes:** CT-009 teclado, foco, 332 px e desktop
  - **Arquivos esperados:** web components/tests
  - **Dependências:** T-004–T-008
  - **Risco:** medium
  - **Critério de conclusão:** tela é utilizável em mobile e passa lint/testes afetados.

- [ ] **T-010:** Remover fallback Supabase após piloto e atualizar documentação.
  - **Cobre:** RF-005
  - **Valida:** CA-009, CA-010
  - **Testes:** CT-010 busca por dependências antigas e smoke
  - **Arquivos esperados:** backend metrics routes, docs
  - **Dependências:** aceite de produção em 005
  - **Risco:** medium
  - **Critério de conclusão:** Monitoring é a única fonte para agentes nativos; rollback passa a ser por release.
