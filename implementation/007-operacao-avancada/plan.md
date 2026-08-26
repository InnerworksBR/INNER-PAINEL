# Plano

## Estratégia

Ativar cada capacidade atrás de flag/job próprio, com teste e rollback independentes. Começar por visibilidade do Worker, depois rollup/retenção/alertas, e deixar comandos/updates por último.

## Arquivos previstos

- Application/Rollup, Retention, Alerting, Commands, Updates
- Cloud Worker hosted services e worker heartbeat
- API management/cockpit/health
- Agent commands/updater
- Diagnostics CLI, migrations, runbooks e testes.

## Sequência reversível

- Flags desligadas por padrão.
- Jobs em dry-run antes de mutar dados.
- Rollout canário para comandos/update.

## Testes e validações

- Golden datasets de rollup, partitions/retention, alert state machine.
- Threat model e E2E de comandos/update.
- Carga, crash recovery e rollback.

## Rollback

- Desabilitar job/flag; preservar eventos/auditoria; voltar pacote anterior.

## Aprovações necessárias

- Spec e revisões de banco/segurança.
- Aprovação específica para retenção, comandos, update e produção.
