# Tarefas — Identidade e autorização

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Fazer threat model de sessão, admin e cofre futuro | RF-083 | CT-017-01 review | security docs/decisions | 011 | high |
| T-002 | Aprovar provedor MFA, recovery e tempos de sessão/step-up | RF-072 | CT-017-02 decision record | ADR/decisions | T-001 | critical |
| T-003 | Modelar grants por empresa/ação e migrations | RF-070, RF-078 | CT-017-03 schema/tenant | migrations | T-002 | high |
| T-004 | Implementar autorização central deny-by-default | RF-070, RF-078 / CA-070 | CT-017-04 role/action matrix | auth hooks/service/tests | T-003 | critical |
| T-005 | Implementar enrolamento, desafio e recuperação MFA | RF-072 | CT-017-05 lifecycle/replay | auth routes/services/UI | T-002,T-003 | critical |
| T-006 | Implementar step-up curto vinculado à sessão/propósito | RF-072 | CT-017-06 expiry/reuse | auth services/routes/tests | T-005 | critical |
| T-007 | Endurecer sessão, revogação e proteção CSRF conforme decisão | RF-083 | CT-017-07 session attacks | auth/server/web/tests | T-002 | critical |
| T-008 | Definir break-glass/exportação desabilitados e auditados | RF-079 | CT-017-08 policy denial | config/audit/tests | T-004,T-006 | high |
| T-009 | Executar modo audit-only e corrigir grants antes do enforcement | RF-070, RF-078 | CT-017-09 pilot logs | services/evidence | T-004..T-008 | high |
| T-010 | Ativar piloto, validar acessibilidade e recuperação | RF-072/083 | CT-017-10 E2E/a11y/runbook | web/tests/docs | T-009 | critical |

T-002 é gate: nenhuma implementação de MFA ou mudança de sessão começa sem essas decisões aprovadas.
