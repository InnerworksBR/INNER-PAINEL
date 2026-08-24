# Plano

## Estratégia

Capturar falhas atuais, corrigir por menor mudança compatível, consolidar uma ordem canônica de migrations e executar o mesmo comando localmente e no CI. Dependências serão avaliadas pelo menor upgrade seguro; exceções terão expiração.

## Arquivos previstos

`backend/package.json`, `backend/package-lock.json`, `backend/src/routes/client/glpi-routes.ts`, `backend/migration_*.sql`, `backend/tests/`, `web/package.json`, `web/package-lock.json`, `web/src/**/*.test.*`, `web/src/**/*.jsx`, `.github/workflows/quality.yml`, `scripts/`, `implementações/README.md`.

## Sequência reversível

1. registrar baseline; 2. corrigir typecheck/testes/lint; 3. adicionar migration aditiva; 4. atualizar dependências compatíveis; 5. criar comando agregado; 6. ativar CI. Nada é aplicado em produção.

## Testes e validações

Backend: typecheck e 12+ testes. Web: lint, 5+ testes e build. Banco: migrations em banco vazio descartável. Dependências: audit de produção. CI: execução limpa reproduzindo os mesmos comandos.

## Rollback

Reverter workflow/scripts e upgrades individualmente. A migration permanece apenas como arquivo até aprovação de deploy.

## Aprovações necessárias

Aprovação desta spec; upgrades major, exceção de vulnerabilidade e aplicação de migration pedem aprovação específica.
