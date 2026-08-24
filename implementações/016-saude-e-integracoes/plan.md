# Plano

## Estratégia

Criar taxonomia comum e registro de execução; corrigir cada adaptador/dashboard; centralizar polling e cache com invalidação por freshness; migrar UI e validar estados por empresas com combinações diferentes de contrato.

## Arquivos previstos

Services/rotas de dashboard, GLPI, Zabbix e Microsoft; migration/registro de execuções se não entregue pela 013; hooks/services e páginas web; testes e fixtures.

## Dados e contratos

Estados: `healthy`, `degraded`, `stale`, `failed`, `not_configured`, `not_applicable`, `unknown`. Cada sinal informa razões e evidências. Métricas MS365 usam nomes semânticos: licenças atribuídas, contas habilitadas e usuários ativos somente quando fonte de atividade existir.

## Sequência reversível

Calcular estado novo em shadow, comparar com dashboard atual, expor contrato v2, migrar cards por flag e remover polling redundante somente após telemetria.

## Testes e validações

Matriz de contrato/configuração/freshness; SKUs removidos; múltiplas abas/usuários; falha externa com cache stale; isolamento e E2E dos dashboards.

## Aprovações necessárias

Spec e definição de SLO/freshness por integração. Permissões Graph adicionais exigem aprovação separada.
