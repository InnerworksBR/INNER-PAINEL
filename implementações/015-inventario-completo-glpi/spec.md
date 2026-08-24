---
id: "015"
title: "Inventário completo do GLPI"
status: awaiting_approval
priority: medium
risk: high
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: ["010", "013"]
requirements: [RF-040, RF-041, RF-042, RF-043, RF-044, RF-045, RF-046, RF-047, RF-048]
---
# Especificação

## Objetivo e escopo

Sincronizar e consultar computadores, monitores, impressoras, equipamentos de rede e instalações de software do GLPI. A UI oferece busca, filtros, paginação, CSV, idade e garantia. Dados da origem permanecem read-only; publicação e overrides locais são separados, auditáveis e não são sobrescritos pelo sync.

## Fora de escopo

- editar o GLPI pelo portal;
- descoberta de ativos fora do GLPI;
- gestão financeira/depreciação completa.

## Requisitos e critérios

- **RF-040/041/042 / CA-040:** ativos e software com campos de identificação, responsabilidade, compra e garantia disponíveis.
- **RF-043/044:** idade/garantia com thresholds, filtros, paginação e exportação.
- **RF-045/046:** overrides preservados; conflitos, remoções, arquivos, duplicações e transferências reconciliados.
- **RF-047 / CA-041:** somente ativos publicados da própria empresa.
- **RF-048:** alertas alimentam o cockpit.

## Restrições e riscos

Tipos e search options variam por versão/plugins do GLPI. O modelo deve suportar ausência de campo sem inventar valor e volumes altos de instalações de software.
