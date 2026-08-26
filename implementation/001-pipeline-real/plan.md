# Plano

## Estratégia

1. Fixar o contrato canônico de host e dimensões de disco.
2. Extrair o processamento para serviços testáveis, deixando o hosted worker apenas orquestrar claims.
3. Persistir cada batch em transação única e idempotente.
4. Criar avaliação de estado/offline e eventos.
5. validar com PostgreSQL real e concorrência de duas instâncias.

## Arquivos previstos

- `monitoring/src/Inner.Monitoring.Cloud.Worker/BatchProcessingWorker.cs`
- novos serviços em `monitoring/src/Inner.Monitoring.Application/Processing/`
- entidades/configurações em `monitoring/src/Inner.Monitoring.Domain/` e `Infrastructure.Postgres/`
- migrations EF e SQL em `monitoring/deploy/migrations/`
- `monitoring/src/Inner.Monitoring.Agent.Windows/Collectors/*.cs` para alinhar identidade
- testes Domain/Integration.

## Sequência reversível

- Criar constraints/índices aditivos.
- Publicar código compatível com batches antigos.
- Rodar em shadow/dry-run sobre cópia de dados.
- Ativar Worker com uma réplica e acompanhar lag/dead letter.
- Só então reprocessar backlog e habilitar detector offline.

## Testes e validações

- Unitários de parser, identidade, deduplicação e estado.
- Integração PostgreSQL para atomicidade, idempotência, concorrência e replay.
- Fixture real produzida pelo agente Windows.
- Teste de queda entre persistência e ACK/processamento.

## Rollback

- Escalar Worker para zero, preservar batches/jobs e voltar à imagem anterior.
- Não remover colunas/tabelas na primeira release.
- Reprocessar backlog após correção; nunca apagar batch como rollback.

## Aprovações necessárias

- Aprovação deste spec.
- Aprovação de migration e plano de replay.
- Aprovação específica para deploy/reprocessamento em produção.
