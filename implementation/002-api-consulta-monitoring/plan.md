# Plano

## Estratégia

Criar contratos orientados ao caso de uso de servidores sobre o modelo genérico de assets. Corrigir primeiro o escopo tenant, depois lista/detalhe/histórico e, por fim, resumo de sources/cockpit e cliente TypeScript.

## Arquivos previstos

- `monitoring/src/Inner.Monitoring.Cloud.Api/Controllers/AssetsController.cs`
- `CompanySourcesController.cs`, `CockpitController.cs`, novo controller/rotas de métricas
- `monitoring/src/Inner.Monitoring.Application/QueryServices/*`
- `monitoring/src/Inner.Monitoring.Contracts/Records/*`
- `backend/src/services/monitoring-api-client.ts`
- testes de contrato e autorização.

## Sequência reversível

- Adicionar contratos/rotas sem remover os existentes.
- Manter versão `/v1` e compatibilidade durante o rollout do BFF.
- Ativar consumo no portal por feature flag em `003`.

## Testes e validações

- Integração com duas empresas e usuários de papéis diferentes.
- Paginação, filtros e limites de histórico.
- Contract tests C# ↔ TypeScript.
- Testes de desempenho para lista sem N+1.

## Rollback

- Desativar novas rotas no BFF; endpoints aditivos permanecem sem impacto.
- Voltar API para imagem anterior sem migration destrutiva.

## Aprovações necessárias

- Aprovação do contrato público e da estratégia de autenticação.
- Revisão independente de auth/tenant antes do deploy.
