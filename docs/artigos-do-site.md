# Artigos do site

O INNER_PAINEL edita os rascunhos e publica versões no Supabase. O site Next.js lê a versão pública em cada requisição. O bucket privado `site-articles` entrega apenas as imagens vinculadas a uma versão publicada.

## Configuração por ambiente

| Aplicação | Variável | Valor |
|---|---|---|
| Backend do Painel | `SITE_ARTICLES_ENABLED` | `true` após validar o site. O padrão é `false`. |
| Backend do Painel | `SITE_ARTICLES_PUBLIC_ORIGIN` | Origem do site usada nos links do editor, por exemplo `https://innerworks.com.br`. |
| Site Next.js | `SITE_ARTICLES_SUPABASE_URL` | URL do projeto Supabase do mesmo ambiente. |
| Site Next.js | `SITE_ARTICLES_SUPABASE_KEY` | Chave publishable ou JWT legado `anon`. A chave administrativa fica no backend do Painel. |
| Site Next.js | `SITE_ARTICLES_SITE_ORIGIN` | Origem canônica. Em homologação, usar a origem do próprio site de teste. |

A migração `backend/migration_029_site_articles.sql` parte das tabelas `public.profiles` e `public.admin_audit_logs` e requer a função `storage.allow_only_operation(text)`. Aplique a migração e depois inclua `site_public` na lista de schemas expostos pelo PostgREST, preservando os schemas existentes. Em Supabase local, ajuste `[api].schemas`. Em Supabase self-hosted, ajuste a lista usada pelo serviço PostgREST.

A leitura direta do bucket depende do Supabase self-hosted e de revalidação a cada requisição autenticada. Configure o proxy do Storage para respeitar a política de cache da origem e valide a retirada com o link direto previamente acessado. Ambientes com Smart CDN precisam de um único ponto de entrega das imagens, com a autorização checada fora do CDN.

O schema `site_editorial` é interno. As funções editoriais da Data API têm permissão de execução somente para `service_role`. O backend verifica o perfil ativo e a autorização editorial antes de executar as operações. Conceda acesso aos administradores indicados pela equipe, usando o UUID confirmado do perfil. O exemplo usa a variável `editor_id` do psql.

```sql
INSERT INTO site_editorial.publishers (user_id)
SELECT id FROM public.profiles
WHERE id = :'editor_id'::uuid AND role = 'admin' AND status = 'active'
ON CONFLICT DO NOTHING;
```

## Homologação e liberação

1. Prepare um PostgreSQL, Auth e Storage de homologação. Use uma conta editorial de teste e uma conta de cliente para a verificação de permissões.
2. Execute `backend/tests/site-articles.integration.sql` contra a instância de teste com `ON_ERROR_STOP` ativo. O script abre uma transação e reverte seus dados.
3. Suba o Painel e o site de homologação apontando para esse projeto. O teste `node --test tests/site-articles.flow.e2e.mjs`, executado no diretório `backend`, usa as variáveis `ARTICLES_E2E_API_URL`, `ARTICLES_E2E_SITE_URL`, `ARTICLES_E2E_SUPABASE_URL`, `ARTICLES_E2E_ANON_KEY`, `ARTICLES_E2E_EDITOR_EMAIL`, `ARTICLES_E2E_EDITOR_PASSWORD`, `ARTICLES_E2E_CLIENT_EMAIL` e `ARTICLES_E2E_CLIENT_PASSWORD`. O teste aceita endereços locais para manter os dados de teste isolados. Para exercitar o sitemap, use a origem canônica de produção no Next.js local e mantenha a URL do teste e o Supabase no ambiente isolado.
4. Valide no navegador o editor, a prévia autenticada e os links do site em uma sessão anônima. Publique, salve uma edição em rascunho, publique a revisão e retire o artigo. Confira também o link direto de uma imagem e a saída do sitemap.
5. Em produção, aplique a migração e configure a leitura pública primeiro. Suba o backend com a edição desabilitada, publique o site e confirme a conexão com o Supabase, então habilite a edição e as contas autorizadas.

O plano de recuperação precisa guardar o banco e os objetos do bucket. Teste a restauração dos dois no mesmo ambiente de homologação. Para reverter a aplicação, desative a edição antes de reverter os deploys e conserve a migração aditiva e os objetos do bucket. Para retirar somente um conteúdo, use **Retirar do ar** no editor. O histórico permite restaurar uma versão anterior com o mesmo endereço.
