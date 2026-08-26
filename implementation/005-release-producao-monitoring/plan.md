# Plano

## Estratégia

Fechar gates locais e revisão independente, preparar backup/migration/rollback, implantar em ordem de dependência e executar piloto antes do rollout da frota.

## Arquivos previstos

- Dockerfiles API/Worker e configuração/documentação EasyPanel
- migrations e runbooks
- testes .NET/backend/web/E2E
- health/telemetria/logging
- documentação `monitoring/docs` e `docs/monitoring`
- manifestos e checklist de release.

## Sequência reversível

1. Backup e restore testado.
2. Migrator aditivo.
3. API compatível com agentes antigos.
4. Worker com uma réplica e backlog controlado.
5. Backend com flag ainda no fallback.
6. Web.
7. Ativar Monitoring para empresa piloto.
8. Atualizar agente piloto e ampliar gradualmente.

## Testes e validações

- `dotnet test`, backend tests/typecheck, web test/build/lint.
- Docker build e smoke de cada serviço.
- E2E real com PostgreSQL e navegador.
- Restore de backup e rollback de imagens/feature flag.

## Rollback

- Feature flag volta a Supabase durante piloto.
- Worker escala para zero sem perder batches.
- API/backend/web retornam ao commit anterior.
- Agente reinstala pacote anterior preservando ProgramData.
- Migration inicial é aditiva; reversão lógica antes de qualquer down migration.

## Aprovações necessárias

- Revisões de código, segurança, banco, testes e deploy.
- Aprovação específica para migration, cada deploy, mudança de flag, rollout e eventual rollback.
