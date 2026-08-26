# Tarefas

- [ ] **T-001:** Injetar company ID explicitamente nas queries de assets e eliminar o stub `GetCompanyIdFromQuery`.
  - **Cobre:** RF-001
  - **Valida:** CA-001, CA-002
  - **Testes:** CT-001 duas empresas e acesso negado
  - **Arquivos esperados:** AssetsController, IAssetQueryService, AssetQueryService
  - **Dependências:** 001 concluída
  - **Risco:** critical
  - **Critério de conclusão:** nenhuma consulta retorna dados fora do tenant e empresa válida não retorna vazio artificialmente.

- [ ] **T-002:** Definir DTO de server overview com métricas compactas e estado.
  - **Cobre:** RF-002, RF-004
  - **Valida:** CA-003, CA-007, CA-008
  - **Testes:** CT-002 source sem asset, asset online/stale/offline
  - **Arquivos esperados:** Contracts/Records
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** uma chamada alimenta a lista sem consultas por linha.

- [ ] **T-003:** Implementar lista paginada, busca, filtros e sort determinístico.
  - **Cobre:** RF-002
  - **Valida:** CA-003, CA-004
  - **Testes:** CT-003 paginação/cursor e filtros
  - **Arquivos esperados:** QueryServices, controller
  - **Dependências:** T-002
  - **Risco:** medium
  - **Critério de conclusão:** contratos e resultados permanecem estáveis com volume.

- [ ] **T-004:** Completar detalhe com catálogo de métricas, unidades, volumes e eventos.
  - **Cobre:** RF-003
  - **Valida:** CA-005
  - **Testes:** CT-004 detalhe completo e not found tenant-safe
  - **Arquivos esperados:** AssetQueryService, DTOs
  - **Dependências:** T-001; implementação 001
  - **Risco:** high
  - **Critério de conclusão:** UI não recebe metric IDs como nomes nem precisa inferir unidades.

- [ ] **T-005:** Criar endpoint de histórico com janela, resolução e limites.
  - **Cobre:** RF-003
  - **Valida:** CA-006
  - **Testes:** CT-005 raw/5m/1h, limites e ausência de dados
  - **Arquivos esperados:** controller e query service de métricas
  - **Dependências:** T-004
  - **Risco:** high
  - **Critério de conclusão:** gráficos recebem séries ordenadas sem consulta ilimitada.

- [ ] **T-006:** Completar resumo de sources/cockpit para frota e status administrativo.
  - **Cobre:** RF-004
  - **Valida:** CA-007, CA-008
  - **Testes:** CT-006 primeira coleta, offline, versões distintas
  - **Arquivos esperados:** SourceQueryService, CockpitQueryService, DTOs
  - **Dependências:** T-001, T-002
  - **Risco:** medium
  - **Critério de conclusão:** total e última sincronização são calculados do dado real.

- [ ] **T-007:** Separar e endurecer autenticação portal/source e reduzir CORS.
  - **Cobre:** RF-001, RF-005
  - **Valida:** CA-001, CA-002, CA-010
  - **Testes:** CT-007 token errado, audience/issuer/role/expiry e cross-tenant
  - **Arquivos esperados:** Program.cs, Authorization, Jwt settings
  - **Dependências:** T-001
  - **Risco:** high
  - **Critério de conclusão:** token de agente não acessa management e token de portal não ingere batch.

- [ ] **T-008:** Corrigir e registrar o cliente TypeScript do Monitoring.
  - **Cobre:** RF-005
  - **Valida:** CA-009
  - **Testes:** CT-008 `tsc --noEmit` e contract fixtures
  - **Arquivos esperados:** backend/src/services/monitoring-api-client.ts, app/plugin
  - **Dependências:** T-002–T-007
  - **Risco:** medium
  - **Critério de conclusão:** arquivo está versionado, typecheck verde e métodos refletem a API real.

- [ ] **T-009:** Criar testes de contrato, segurança e performance de consulta.
  - **Cobre:** RF-001–RF-005
  - **Valida:** CA-001–CA-010
  - **Testes:** CT-009 suíte automatizada completa
  - **Arquivos esperados:** IntegrationTests, backend tests
  - **Dependências:** T-001–T-008
  - **Risco:** high
  - **Critério de conclusão:** testes detectam vazamento tenant, N+1 e divergência de DTO.
