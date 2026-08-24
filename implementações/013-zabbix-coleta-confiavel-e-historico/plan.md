# Plano

## Estratégia

Criar cliente de API por execução e modelo de capacidades; introduzir registro/lease de jobs conforme ADR-002; normalizar itens/freshness; reconciliar hosts; só então alterar cálculo, retenção e UI. Rollout por empresa piloto.

## Arquivos previstos

`backend/src/services/zabbix-service.ts`, scheduler/server, novas services de job, migrations, testes/fixtures; rotas de server/network/dashboard; páginas Servidores/Rede e seus testes.

## Dados e contratos

Configuração por integração: auth mode, timeout, retry, concurrency, freshness, templates/keys esperadas. Execução registra cobertura. Métrica guarda valor, clock da fonte, coletado em e estado. Agregados horários/diários são separados do bruto.

## Sequência reversível

Instrumentation; cliente seguro; lease; escrita paralela de freshness/agregados; comparação; UI por flag; ativação do novo scheduler; desativação do antigo. Colunas/tabelas não são removidas no rollback.

## Testes e validações

Fixtures por versão, logout em erros, timeout/retry, duas instâncias concorrentes, clock stale, host removido, uptime sem amostra, retenção e gráficos longos.

## Aprovações necessárias

Spec/migrations. Retenção definitiva, backfill e mudança de credenciais nas instâncias exigem aprovação operacional.
