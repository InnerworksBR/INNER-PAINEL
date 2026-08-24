# Plano

## Estratégia

Descobrir capacidades do GLPI, criar modelo normalizado com dados brutos rastreáveis, sincronizar por tipo de forma incremental e reconciliada, separar publicação/override, expor APIs paginadas e construir UI/alertas por etapas.

## Arquivos previstos

Adaptador GLPI, services de inventory/software/reconciliation, migrations, rotas client/admin e testes; páginas de inventário, navegação, filtros, exportação e testes.

## Dados e contratos

Ativo: empresa, source type/id/entity, status, identidade, ownership/localização, datas, garantia, published, lifecycle e timestamps da origem. Software/versão e instalação são entidades separadas. Override guarda campo, valor, autor e conflito.

## Sequência reversível

Migration; sync shadow; comparação; publicação admin; UI por flag; alertas; piloto. Rollback desativa sync/UI e preserva dados novos para diagnóstico.

## Testes e validações

Fixtures por tipo/versão, sync idempotente, transferências/remoções, overrides, isolamento, paginação/CSV, volume de software, idade/garantia/timezone e E2E client/admin.

## Aprovações necessárias

Spec/migrations, thresholds de idade/garantia e política inicial de publicação.
