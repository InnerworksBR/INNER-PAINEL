# Tarefas — Saúde e integrações

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Definir taxonomia de health, razões e aplicabilidade | RF-086 | CT-016-01 matriz | contracts/decisions | 012,013 | high |
| T-002 | Definir SLO/freshness configurável por integração | RF-005/036 | CT-016-02 boundaries | config/tests | T-001 | medium |
| T-003 | Corrigir detecção GLPI para `glpi_entity_id` real | RF-084 | CT-016-03 combinations | dashboard routes/tests | 012 | medium |
| T-004 | Instrumentar tentativa/sucesso/duração/volume/erro | RF-036 | CT-016-04 execution states | services/migration/tests | 013 | medium |
| T-005 | Corrigir nomenclatura e cálculo de métricas MS365 | RF-085 | CT-016-05 semantic fixtures | MS service/routes/pages | T-001 | high |
| T-006 | Reconciliar SKUs removidos ou não retornados | RF-085 | CT-016-06 stale SKU | MS service/tests | T-005 | medium |
| T-007 | Implementar health por razões sem penalizar `not_applicable` | RF-086 | CT-016-07 contract matrix | dashboard service/tests | T-002..T-006 | high |
| T-008 | Centralizar polling/cache e deduplicar requisições web | RF-087 | CT-016-08 multi-tab/users | web hooks/backend cache | T-002,T-004 | medium |
| T-009 | Exibir período, origem, freshness e estados completos | RF-004/005 | CT-016-09 UI/E2E | dashboard/pages | T-007,T-008 | medium |
| T-010 | Validar empresas piloto com módulos distintos | RF-084..087 | CT-016-10 pilot/isolation | tests/evidence | T-003..T-009 | high |

Nenhum indicador pode ser rotulado “ativo” sem uma fonte de atividade correspondente.
