# Tarefas — GLPI: chamados, SLA e períodos

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Capturar versão, timezone, search options e amostra SLA do GLPI | RF-016 / CA-013 | CT-012-01 fixture aprovada | fixtures/decisions | 010 | high |
| T-002 | Especificar normalizador único de filtros e envelope | RF-010..013 | CT-012-02 matriz query | backend contracts | T-001 | medium |
| T-003 | Criar migration aditiva de datas/SLA/mapping version | RF-003, RF-016 | CT-012-03 banco vazio/backfill | migration | T-001 | high |
| T-004 | Implementar derivação TTR e cobertura SLA | RF-014/015 / CA-012/013 | CT-012-04 estados/denominador | GLPI service/tests | T-001,T-003 | high |
| T-005 | Implementar sync incremental, overlap, idempotência e reconciliação | RF-017 | CT-012-05 replay/late update | GLPI service/tests | T-003 | high |
| T-006 | Implementar lista/agregados server-side paginados | RF-010, RF-011, RF-012, RF-013, RF-014, RF-015 / CA-010, CA-011, CA-012 | CT-012-06 API/tenant | GLPI routes/tests | T-002,T-004 | high |
| T-007 | Fazer CSV reutilizar o filtro e o conjunto da API | RF-012 | CT-012-07 equivalência CSV | GLPI routes/tests | T-006 | medium |
| T-008 | Implementar detalhe com último estado válido e erro claro | RF-018 | CT-012-08 GLPI offline | service/routes | T-005 | medium |
| T-009 | Migrar UI Chamados para 30d, presets e custom/all | RF-010, RF-011, RF-012, RF-013, RF-014, RF-015 / CA-010, CA-011 | CT-012-09 UI/E2E | página Chamados | T-006,T-007 | medium |
| T-010 | Alinhar dashboard geral ao default e metadados | RF-019, RF-005 | CT-012-10 dashboard | dashboard routes/pages | T-006 | medium |
| T-011 | Validar performance, isolamento e amostra contra GLPI | RNF-001/004/005 / CA-013 | CT-012-11 carga + reconciliação | tests/evidence | T-005..T-010 | high |

Conclusão exige evidência de que chamados sem SLA não reduzem o percentual e que `all` nunca é implícito.
