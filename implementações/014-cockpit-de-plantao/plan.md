# Plano

## Estratégia

Definir taxonomia de sinais e cálculo explicável, construir read model por empresa, expor API filtrável e depois criar a UI. Atualizações vêm dos syncs/read model, não de fan-out para integrações externas por acesso.

## Arquivos previstos

Migrations de alertas/read model, services de cockpit/criticidade, rotas admin, auditoria, páginas/rotas/sidebar admin e testes.

## Dados e contratos

Sinal: empresa, tipo, severidade, estado, origem, objeto/link, ocorrida em, freshness, fingerprint e reconhecimento. Score retorna também fatores contribuintes; estados `not_applicable` não penalizam.

## Sequência reversível

Read model em shadow; comparação manual; API protegida; UI por feature flag; empresa piloto; ativação geral. Rollback desliga UI/job sem apagar eventos.

## Testes e validações

Unitários de score/taxonomia, integração multiempresa, idempotência de fingerprint/reconhecimento, E2E de filtros/drill-down, p95 abaixo de 2 s no volume acordado, acessibilidade por teclado.

## Aprovações necessárias

Spec, pesos/thresholds iniciais e definição de quem pode reconhecer alertas.
