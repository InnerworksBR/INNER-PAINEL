# Tarefas — Cofre de credenciais

> Todas as tarefas estão bloqueadas até os gates T-001/T-002 e conclusão da 017.

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Aprovar threat model, provider de chaves, recovery e retenção | RF-074, RF-075 | CT-018-01 security sign-off | ADR/decisions/runbook | 017 | critical |
| T-002 | Validar MFA/step-up/RBAC em produção piloto | RF-070, RF-072, RF-078 / CA-070 | CT-018-02 negative matrix | evidence | 017,T-001 | critical |
| T-003 | Criar interface de crypto provider e testes sem segredo em logs | RF-074, RF-076 | CT-018-03 provider failure/redaction | crypto service/tests | T-001 | critical |
| T-004 | Criar migrations de metadata, versões e ciphertext | RF-074, RF-075 | CT-018-04 schema/tenant | migrations/tests | T-001,T-003 | critical |
| T-005 | Implementar create/update/version/soft-delete/restore | RF-073, RF-074, RF-075, RF-076 | CT-018-05 lifecycle/concurrency | vault service/tests | T-004 | critical |
| T-006 | Implementar list/detail somente com metadata mascarada | RF-070, RF-071, RF-078 / CA-070 | CT-018-06 direct ID/tenant | routes/tests | T-002,T-005 | critical |
| T-007 | Implementar reveal/copy com step-up, no-store e TTL | RF-072, RF-076, RF-077 | CT-018-07 expiry/cache/replay | routes/service/tests | T-002,T-005 | critical |
| T-008 | Implementar auditoria completa sem valor secreto | RF-073 / CA-071 | CT-018-08 log scan | audit service/tests | T-005..T-007 | critical |
| T-009 | Criar UI admin acessível com limpeza de estado/clipboard | RF-070, RF-071, RF-072, RF-073, RF-074, RF-075, RF-076, RF-077 | CT-018-09 E2E/a11y/timeout | admin pages/tests | T-006..T-008 | high |
| T-010 | Implementar rotação e compatibilidade de versões | RF-074 / CA-072 | CT-018-10 rotate/recover | crypto/vault service | T-003..T-005 | critical |
| T-011 | Provar isolamento, backup/restore e falhas do provider | RF-078, RF-079 / CA-070, CA-071, CA-072 | CT-018-11 security/DR | tests/runbook | T-006..T-010 | critical |
| T-012 | Security review independente e piloto restrito | todos | CT-018-12 review/pilot | evidence/index | T-011 | critical |

Nenhuma tarefa conclui usando segredo real de cliente em desenvolvimento/teste.
