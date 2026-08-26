# Plano

## Estratégia

Entregar SNMP e Hyper-V separadamente sobre os contratos/pipeline já estabilizados, unificando apenas a consulta genérica de assets e o portal.

## Arquivos previstos

- `Inner.Monitoring.Edge.Collector/*`
- segurança/credenciais, ranges e profiles
- `Inner.Monitoring.Application/HyperV/*`
- Agent collector registry/config
- Worker processors, API queries e páginas Rede/Servidores
- testes/simuladores.

## Sequência reversível

- Habilitação por capability/config e por empresa/site.
- Piloto em range pequeno e um host Hyper-V.
- Desativação por configuração sem remover assets/histórico.

## Testes e validações

- Simuladores SNMP v2c/v3, timeout e credencial errada.
- Hyper-V com VM ligada/desligada/renomeada.
- Idempotência, tenant e performance de ranges.

## Rollback

- Desabilitar collectors/profiles/ranges e preservar dados coletados.

## Aprovações necessárias

- Spec, security review, ranges de rede e piloto em ambiente autorizado.
