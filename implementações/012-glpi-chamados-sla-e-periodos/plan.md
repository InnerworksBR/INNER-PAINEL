# Plano

## Estratégia

Definir contrato de filtros e semântica do SLA antes da UI. Criar migration aditiva e backfill controlado; adaptar sync com cursor e sobreposição; alterar API e CSV; então migrar Chamados/dashboard e validar contra amostra real do GLPI.

## Arquivos previstos

`backend/src/services/glpi-service.ts`, `backend/src/routes/client/glpi-routes.ts`, dashboard routes, migrations, testes/fixtures; páginas Chamados/Dashboard, serviços e testes web.

## Dados e contratos

Query: `period=7d|30d|90d|custom|all`, `from`, `to`, `page`, `pageSize`, `search`, `status`, `sort`. Resposta segue ADR-001 e inclui agregados do conjunto. SLA preserva raw state/deadline/resolution, derivação e `mapping_version`.

## Sequência reversível

Migration; escrita dos novos campos; comparação; endpoint compatível; UI por feature flag; troca do default; backfill e reconciliação. Rollback volta a leitura/flag sem remover colunas.

## Testes e validações

Unitários de período/timezone/SLA; integração de paginação/CSV/tenant; contrato com fixtures GLPI; amostra manual aprovada; performance com histórico representativo.

## Aprovações necessárias

Spec e migration. Confirmar versões GLPI e se há SLA TTO contratual antes de fechar o mapeamento.
