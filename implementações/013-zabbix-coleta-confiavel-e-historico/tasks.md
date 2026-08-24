# Tarefas — Zabbix: coleta confiável e histórico

| ID | Tarefa | Cobre / valida | Testes | Arquivos esperados | Dep. | Risco |
|---|---|---|---|---|---|---|
| T-001 | Mapear versões, volume, templates e keys por ambiente | RF-024, RF-029 | CT-013-01 matriz de cobertura | fixtures/decisions | 010 | high |
| T-002 | Implementar cliente por execução com token ou login/logout `finally` | RF-020 / CA-020 | CT-013-02 sucesso/erro | zabbix service/tests | T-001 | high |
| T-003 | Adicionar timeout, retry/backoff/jitter e concorrência | RF-021 | CT-013-03 falhas transitórias | zabbix service/tests | T-002 | high |
| T-004 | Criar migration e serviço de execução/lease distribuído | RF-022 / CA-023 | CT-013-04 duas réplicas | migration/job service | 010 | high |
| T-005 | Coordenar scheduler sem sobreposição e recuperar lease expirado | RF-021/022 | CT-013-05 overlap/crash | server/scheduler/tests | T-003,T-004 | high |
| T-006 | Versionar mapeamento de itens por template/OS | RF-024, RF-029 | CT-013-06 supported/missing | config/service/tests | T-001 | medium |
| T-007 | Persistir clock/freshness e excluir stale da saúde | RF-023 / CA-021 | CT-013-07 boundary freshness | migration/service | T-005,T-006 | high |
| T-008 | Calcular uptime por janela e representar sem dados | RF-025 / CA-022 | CT-013-08 janela/amostra | network routes/tests | T-007 | high |
| T-009 | Reconciliar host removido/desabilitado/sem cobertura | RF-026 | CT-013-09 lifecycle | service/tests | T-005,T-006 | medium |
| T-010 | Criar agregados e job de retenção configurável | RF-027 / CA-024 | CT-013-10 rollup/retention | migration/services | T-004,T-007 | high |
| T-011 | Normalizar eventos e diagnóstico de integração | RF-028/029 | CT-013-11 schema/redaction | routes/services | T-005..T-009 | medium |
| T-012 | Atualizar Servidores/Rede e validar piloto/performance | RF-023/025/028 | CT-013-12 E2E/carga | web pages/tests | T-007..T-011 | high |

Nenhuma política apagará histórico antes de medição, homologação e aprovação de produção.
