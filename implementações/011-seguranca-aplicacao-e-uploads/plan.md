# Plano

## Estratégia

Primeiro provar o exploit em teste controlado, depois isolar conteúdo com sandbox/origem opaca e CSP. Uploads passam por validação de assinatura e limites antes da persistência, com compensação em falha. Controles HTTP entram por configuração fail-closed em produção.

## Arquivos previstos

`backend/src/server.ts`, `backend/src/routes/auth.ts`, rotas/services de security e upload, `.env.example`, testes backend; `web/src/pages/paginasClient/Segurança/`, serviços web e testes.

## Sequência reversível

Adicionar testes negativos; implementar sandbox; endurecer pipeline de upload; adicionar rate limit, CORS e headers; ativar por ambiente; executar smoke tests.

## Testes e validações

Testes de iframe hostile, magic bytes/MIME, tamanho total, falha parcial e multiempresa; brute-force controlado; CORS preflight; headers/cache; ausência de segredo em logs.

## Rollback

Feature flag para novo visualizador; controles HTTP configuráveis com defaults seguros. Não reativar wildcard em produção como rollback.

## Aprovações necessárias

Aprovação da spec. Qualquer migração de JWT para cookie ou alteração disruptiva de sessão depende da implementação 017.
