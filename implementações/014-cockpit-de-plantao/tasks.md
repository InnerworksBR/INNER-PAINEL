# Tarefas — Cockpit de plantão

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Definir taxonomia, severidades e estados aplicável/stale/falha | RF-031, RF-034 | CT-014-01 matriz | spec/decisions/config | 012,013,016 | high |
| T-002 | Definir score explicável, pesos e thresholds configuráveis | RF-030, RF-035 | CT-014-02 cenários | service/config/tests | T-001 | high |
| T-003 | Criar migration de sinais, fingerprints e reconhecimento | RF-033 | CT-014-03 banco vazio | migration | T-001 | medium |
| T-004 | Construir read model idempotente por empresa | RF-030, RF-031, RF-034, RF-036 | CT-014-04 replay/stale | cockpit service | T-002,T-003 | high |
| T-005 | Expor API admin paginada com filtros e fatores do score | RF-030, RF-031, RF-032, RF-033, RF-034, RF-035, RF-036 / CA-030 | CT-014-05 API/tenant | admin routes/tests | T-004 | medium |
| T-006 | Implementar reconhecimento auditável e concorrente | RF-033 | CT-014-06 acknowledge race | routes/audit/tests | T-003,T-005 | medium |
| T-007 | Criar tela responsiva, estados e filtros do cockpit | RF-030, RF-031, RF-032, RF-033, RF-034, RF-035, RF-036 | CT-014-07 UI/E2E | admin page/routes/sidebar | T-005 | medium |
| T-008 | Implementar drill-down preservando empresa e filtro | RF-033 / CA-031 | CT-014-08 navigation/tenant | admin page/routes | T-005,T-007 | high |
| T-009 | Validar acessibilidade, performance e empresa piloto | RNF-004/009 / CA-030/031 | CT-014-09 a11y/load/pilot | tests/evidence | T-006..T-008 | medium |

Score e seus fatores devem ser visíveis; um cliente sem módulo contratado não pode aparecer como falha.
