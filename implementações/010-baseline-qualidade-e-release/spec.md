---
id: "010"
title: "Baseline de qualidade e release"
status: awaiting_approval
priority: critical
risk: medium
created_at: 2026-07-16
updated_at: 2026-07-16
depends_on: []
requirements: [RF-001, RF-002, RF-003]
---
# Especificação

## Objetivo e escopo

Restabelecer um baseline verificável antes das features operacionais: corrigir os gates já quebrados, tornar migrations reproduzíveis, tratar vulnerabilidades altas e automatizar typecheck, lint, testes, build e audit em CI.

Inclui backend e web, scripts de validação, migration ausente de `glpi_date_mod`, testes atuais divergentes, política de dependências e atualização coerente do índice de implementações.

## Fora de escopo

- deploy ou migration em produção;
- refatoração funcional de GLPI/Zabbix;
- substituir o provedor de CI ou fazer upgrades major sem análise separada.

## Requisitos e critérios

- **RF-001 / CA-001:** CI bloqueia falhas de typecheck, lint, testes e build.
- **RF-002 / CA-002:** status só chega a concluído com tarefas, critérios e gates fechados.
- **RF-003:** migrations ordenadas criam um banco vazio compatível com o código.
- **CA-082:** nenhuma vulnerabilidade alta permanece sem exceção documentada, responsável e prazo.

## Restrições

Manter scripts locais executáveis fora do CI. Mudanças de dependência e schema exigem aprovação desta spec; execução em produção continua proibida.

## Riscos

Upgrade transitivo pode alterar comportamento; baseline de migration pode revelar drift entre arquivos duplicados na raiz e em `backend/`.
