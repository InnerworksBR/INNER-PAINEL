# Tarefas — Baseline de qualidade e release

> Progresso: 0/10. Nenhuma alteração de código começa antes da aprovação desta spec.

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Registrar comandos, versões e falhas do baseline | RF-001 | CT-010-01 relatório reproduzível | `docs/`, `implementações/010-*/decisions.md` | — | low |
| T-002 | Corrigir o erro TypeScript de `targetCompanyId` sem afrouxar tipos | RF-001 / CA-001 | CT-010-02 typecheck backend | `backend/src/routes/client/glpi-routes.ts` | T-001 | low |
| T-003 | Corrigir os erros de lint mantendo regras ativas | RF-001 / CA-001 | CT-010-03 lint web | `web/src/` | T-001 | medium |
| T-004 | Alinhar testes de Conta ao contrato atual e adicionar regressão | RF-001 / CA-001 | CT-010-04 suíte web | `web/src/pages/paginasClient/Conta/` | T-001 | low |
| T-005 | Criar migration canônica para `glpi_date_mod` e validar ordem | RF-003 | CT-010-05 banco vazio | `backend/migration_010.sql`, scripts | T-001 | high |
| T-006 | Eliminar duplicidade/drift entre migrations da raiz e backend | RF-003 | CT-010-06 checksum/ordem | `scripts/`, docs | T-005 | medium |
| T-007 | Corrigir vulnerabilidades altas compatíveis e registrar exceções | RF-001 / CA-082 | CT-010-07 npm audit prod | package/lockfiles | T-001 | high |
| T-008 | Criar comando agregado de quality gate | RF-001 / CA-001 | CT-010-08 execução local limpa | package files, `scripts/` | T-002..T-007 | medium |
| T-009 | Criar CI com cache e gates obrigatórios | RF-001 / CA-001 | CT-010-09 workflow em PR | `.github/workflows/quality.yml` | T-008 | medium |
| T-010 | Reexecutar gates e atualizar status somente com evidências | RF-002 / CA-002 | CT-010-10 matriz completa | implementação e índice | T-009 | low |

Cada tarefa só conclui com comando, exit code, resultado e limitações registrados.
