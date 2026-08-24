# ADR-001: Contrato único para dados operacionais

- Status: proposed
- Data: 2026-07-16

## Contexto

Listas, cards, gráficos e CSV hoje podem operar sobre conjuntos ou períodos diferentes. O PRD exige período explícito, paginação no backend, freshness e origem.

## Decisão

Adotar um filtro normalizado no backend e um envelope comum com `data`, `page`, `filter` e `meta`. Chamados usam `30d` quando o período é omitido; `all` exige seleção explícita. Métricas e exportação recebem o mesmo filtro normalizado, e a UI não recalcula totais a partir de páginas parciais.

## Alternativas

- manter filtros apenas no frontend: rejeitada por baixar histórico completo e gerar métricas inconsistentes;
- endpoints independentes sem contrato comum: rejeitada por duplicar regras e aumentar drift;
- GraphQL nesta fase: rejeitada por custo de migração sem resolver por si só semântica e freshness.

## Consequências

Contratos existentes precisarão de compatibilidade temporária. Consultas e índices terão de ser revistos. O mesmo padrão poderá atender GLPI, inventário, cockpit e histórico do Zabbix.

## Evidências

RF-004, RF-005, RF-010 a RF-019, RNF-004 e RNF-005 do PRD aprovado.
