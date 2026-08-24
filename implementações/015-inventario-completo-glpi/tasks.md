# Tarefas — Inventário completo do GLPI

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Descobrir tipos, search options, campos e volumes GLPI | RF-040, RF-041, RF-042 | CT-015-01 matriz/fixtures | fixtures/decisions | 010 | high |
| T-002 | Modelar ativos, software, instalações, publicação e overrides | RF-040..047 | CT-015-02 schema review | spec/migration | T-001 | high |
| T-003 | Criar migrations aditivas, índices e isolamento | RF-040..047 / CA-041 | CT-015-03 banco vazio/tenant | migrations/tests | T-002 | high |
| T-004 | Implementar sync incremental por tipo de ativo | RF-040, RF-042 | CT-015-04 replay/partial | GLPI/inventory services | T-001,T-003 | high |
| T-005 | Implementar catálogo e instalações de software em lotes | RF-041 | CT-015-05 volume/version | software service/tests | T-001,T-003 | high |
| T-006 | Reconciliar removido, arquivado, duplicado e transferido | RF-046 | CT-015-06 lifecycle | reconciliation service/tests | T-004,T-005 | high |
| T-007 | Separar override/publicação e registrar conflitos/auditoria | RF-045/047 | CT-015-07 source update | admin routes/services | T-003,T-006 | high |
| T-008 | Calcular idade/garantia com thresholds configuráveis | RF-043 | CT-015-08 dates/boundaries | service/config/tests | T-004 | medium |
| T-009 | Expor APIs client/admin paginadas e filtráveis | RF-041, RF-042, RF-044, RF-047 | CT-015-09 API/tenant | routes/tests | T-005,T-007,T-008 | high |
| T-010 | Criar CSV server-side do conjunto filtrado | RF-044 | CT-015-10 equivalência CSV | routes/tests | T-009 | medium |
| T-011 | Criar telas admin de reconciliação/publicação | RF-045..047 | CT-015-11 admin E2E | admin pages | T-007,T-009 | medium |
| T-012 | Criar telas client de ativos e software | RF-040, RF-041, RF-042, RF-043, RF-044, RF-047 / CA-040, CA-041 | CT-015-12 client E2E | client pages/routes | T-009,T-010 | medium |
| T-013 | Publicar alertas de garantia/idade/ausência ao cockpit | RF-048 | CT-015-13 signal idempotency | services/tests | 014,T-008 | medium |
| T-014 | Validar carga, isolamento e amostra contra GLPI | CA-040/041, RNF-004/005 | CT-015-14 load/reconcile | tests/evidence | T-004..T-013 | high |

Campos ausentes permanecem nulos/com origem explícita; não serão inferidos como fatos.
