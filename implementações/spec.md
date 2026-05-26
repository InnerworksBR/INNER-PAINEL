# Spec - Batidao de prontidao do Portal Inner

## 1. Objetivo

Preparar o app para apresentacao ao cliente e para a proxima rodada de implementacao com base em uma varredura do codigo atual.

Esta especificacao cobre tres frentes:

1. corrigir bugs que podem comprometer a demonstracao ou a confianca no portal;
2. fechar lacunas evidentes do usuario final, com prioridade para configuracoes de conta e troca de senha;
3. reduzir riscos de seguranca que ja aparecem no codigo e nas dependencias instaladas.

## 2. Escopo da varredura

Foram lidos os fluxos principais do workspace em 22/05/2026:

- backend Fastify, autenticacao JWT e integracao com Supabase;
- rotas de cliente, admin, documentos, usuarios, empresas, inventario e preview;
- portal React, layouts, sidebar, roteamento e paginas de cliente/admin;
- migrations e schema de isolamento por empresa;
- scripts auxiliares rastreados no repositorio;
- verificacoes locais de build, lint, TypeScript e `npm audit`.

Comandos executados:

- `npm run build` em `web`: passou, com aviso de chunk JS acima de 500 kB;
- `npm run lint` em `web`: falhou com 1 erro e 3 warnings;
- `npx tsc --noEmit` em `backend`: passou;
- `npm audit --omit=dev --audit-level=high` em `backend`: falhou com vulnerabilidades de severidade alta e critica;
- `npm audit --omit=dev --audit-level=high` em `web`: falhou com vulnerabilidade alta em dependencia de producao.

## 3. Estado atual identificado

### 3.1. O que ja existe

- Login centralizado em `backend/src/routes/auth.ts`.
- JWT proprio do backend com timeout configuravel em `system_settings`.
- Controle admin/client no token e em hooks de rota.
- Portal do cliente com Dashboard, Microsoft 365, Servidores, Rede, Documentacao e Chamados GLPI.
- Painel administrativo com empresas, usuarios, documentos, configuracoes, auditoria e inventario.
- Preview de empresa em `/admin/empresas/:companyId/preview`.
- Helper de escopo por empresa em `backend/src/services/company-scope-service.ts`.
- RLS no banco para tabelas de dados de cliente, embora varias rotas do backend leiam via `supabaseAdmin` e portanto dependam tambem do filtro aplicado no codigo.

### 3.2. O que nao existe para o usuario final

O portal de cliente nao possui hoje uma area de conta/configuracoes. A sidebar de `web/src/components/Sidebar.jsx` so expoe modulos operacionais e logout.

Nao foi encontrada rota autenticada para o proprio usuario:

- trocar a propria senha;
- atualizar dados basicos permitidos do perfil;
- consultar seguranca da conta ou encerrar sessoes;
- iniciar recuperacao de senha sem acao do admin.

Hoje a redefinicao de senha esta no fluxo administrativo em `backend/src/routes/admin/users-routes.ts` e `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`.

## 4. Achados priorizados

### P0 - Bloqueadores de confianca e seguranca

#### P0.1. Dependencias de producao com alertas altos/criticos

Evidencia:

- `backend/package.json`;
- `web/package.json`;
- saida local de `npm audit` em 22/05/2026.

Impacto:

- o backend auditado reporta vulnerabilidades em `fast-jwt`, `fastify`, `fast-uri` e `axios`;
- o frontend auditado reporta vulnerabilidade alta em `axios`;
- parte da correcao do JWT aponta para upgrade de major version de `@fastify/jwt`, portanto precisa de verificacao de compatibilidade.

Decisao:

- atualizar dependencias antes de tratar o baseline como pronto;
- registrar resultado do audit apos o upgrade;
- testar login, validacao JWT, rotas admin e preview depois do upgrade.

#### P0.2. Revogacao de privilegio depende do JWT antigo expirar

Evidencia:

- `backend/src/routes/auth.ts` assina `role` e `company_id` dentro do JWT;
- `backend/src/plugins/jwt.ts` reconsulta apenas `status`;
- `backend/src/hooks/auth-hook.ts` autoriza admin pelo `role` do payload.

Impacto:

- um admin rebaixado para client pode continuar sendo tratado como admin enquanto o token emitido antes da mudanca continuar valido;
- uma mudanca de empresa do usuario tambem pode ficar defasada no payload;
- o backend usa `supabaseAdmin` em rotas sensiveis, entao erro de escopo no codigo tem blast radius maior.

Decisao:

- a autorizacao deve usar estado atual do perfil para `role`, `company_id` e `status`, ou um mecanismo equivalente de revogacao/versionamento de sessao;
- perfil inexistente, bloqueado ou inconsistente deve falhar fechado.

#### P0.3. Credenciais bootstrap previsiveis em script rastreado

Evidencia:

- `backend/create_users.js` cria admin e cliente com a mesma senha literal.

Impacto:

- se o script foi executado em ambiente real e a senha nao foi trocada, ha risco direto de acesso indevido;
- a existencia de senha bootstrap previsivel em codigo incentiva reutilizacao em demo/producao.

Decisao:

- remover senhas literais do repositorio;
- receber senha por variavel/env ou gerar senha temporaria unica;
- exigir troca no primeiro acesso se o fluxo bootstrap continuar existindo;
- rotacionar contas ja criadas por esse script quando aplicavel.

#### P0.4. Usuario final nao consegue trocar senha

Evidencia:

- ausencia de rota de conta do cliente em `web/src/rotas/rotas.jsx`;
- ausencia de item de conta em `web/src/components/Sidebar.jsx`;
- unica rota de alteracao de senha encontrada e admin-only.

Impacto:

- operacao basica do portal depende do time interno;
- cliente nao tem autonomia minima de conta;
- em apresentacao, a pergunta "onde troco minha senha?" fica sem resposta dentro do produto.

Decisao:

- entregar uma area de conta do usuario final com troca de senha autenticada como primeira lacuna funcional.

### P1 - Corrigir antes de ampliar uso

#### P1.1. Sessao em `localStorage` amplia impacto de XSS

Evidencia:

- `web/src/context/AuthContext.jsx`;
- `web/src/services/api.js`;
- `web/src/pages/Login/login.jsx`.

Impacto:

- token Bearer e perfil ficam acessiveis a JavaScript no navegador;
- qualquer XSS futuro pode transformar bug de frontend em sequestro de sessao.

Decisao:

- desenhar migracao para cookie `HttpOnly`, `Secure` e politica `SameSite` adequada, ou documentar formalmente uma alternativa com risco aceito e CSP forte;
- nao depender apenas de limpar `localStorage` em 401 como estrategia de seguranca.

#### P1.2. Login sem defesa explicita contra tentativa repetida

Evidencia:

- `/api/auth/login` em `backend/src/routes/auth.ts` nao registra rate limit por IP/identificador nem mecanismo local de desaceleracao;
- o projeto nao registra plugin de rate limit no servidor.

Impacto:

- o endpoint do portal fica mais exposto a brute force, credential stuffing e ruido operacional;
- toda protecao fica implicitamente delegada ao provedor downstream.

Decisao:

- aplicar rate limit no login e em rotas de maior custo;
- logar falhas de autenticacao de forma util sem vazar senha, token ou existencia de conta.

#### P1.3. Baseline HTTP permissivo

Evidencia:

- `backend/src/plugins/cors.ts` cai para `origin: '*'` quando `FRONTEND_URL` nao esta configurada;
- o servidor nao registra plugin equivalente a security headers.

Impacto:

- configuracao de producao pode subir permissiva por omissao;
- faltam camadas de defesa no navegador para reduzir superficie de injecao e embedding indevido.

Decisao:

- CORS deve falhar fechado em producao;
- adicionar security headers e revisar CSP de acordo com os assets e integracoes reais do portal.

#### P1.4. Rotas de cliente podem devolver visao global para admin sem escopo

Evidencia:

- `resolveCompanyScope` retorna `targetCompanyId: null` para admin sem `company_id`;
- rotas em `backend/src/routes/client/*` deixam a query sem `.eq('company_id', ...)` quando o target e `null`;
- o preview depende do frontend anexar `company_id` via `web/src/services/api.js` e `useClientRequestConfig`.

Impacto:

- chamadas admin diretas para endpoints de cliente podem misturar tenants;
- um futuro componente que esquecer o escopo pode parecer funcionar e carregar mais dados que o esperado;
- como as rotas usam `supabaseAdmin`, RLS nao e a barreira final nesse caminho.

Decisao:

- endpoints de experiencia do cliente devem exigir escopo explicito quando chamados por admin, exceto rotas administrativas globais separadas e intencionais;
- adicionar testes negativos de isolamento.

#### P1.5. Preview nao e totalmente fiel ao que o cliente ve

Evidencia:

- `web/src/pages/paginasClient/Microsoft/microsoft.jsx` exibe controle admin quando `user.role === 'admin'`;
- a mesma pagina mostra perfil `Administrador` no preview;
- o controle admin chama `PATCH /admin/ms365/licenses/:id/dashboard-inclusion`.

Impacto:

- o preview exibido ao cliente durante a demonstracao pode mostrar uma area que o cliente real nao ve;
- o preview mistura modo de leitura com acao administrativa de alteracao.

Decisao:

- o preview deve ocultar mutacoes/admin-only quando a meta for "ver como cliente";
- informacoes de tenant devem usar a empresa em preview quando aplicavel.

#### P1.6. Upload de documentos precisa endurecimento

Evidencia:

- `backend/src/routes/admin/docs-routes.ts` aceita arquivos multipart e repassa `mimetype` recebido;
- o handler materializa arquivos com `toBuffer()`;
- a restricao de MIME e criada no bucket em `backend/src/services/storage-service.ts`, nao validada na rota;
- se o insert no banco falha apos upload, nao ha rollback dos objetos ja enviados.

Impacto:

- bucket preexistente permissivo pode aceitar tipo inesperado;
- upload grande admin-only ainda pode pressionar memoria;
- falha parcial pode deixar arquivo orfao no storage.

Decisao:

- validar MIME/extensao e limites na rota;
- preferir fluxo com limpeza de objetos em erro;
- manter bucket privado e URLs assinadas curtas.

### P2 - Qualidade e acabamento

#### P2.1. Lint falha e indica riscos de estado obsoleto

Evidencia:

- erro em `web/src/context/ClientPreviewContext.jsx` no memo de request config;
- warnings de dependencias em `web/src/pages/paginasClient/Rede/rede.jsx`;
- warnings de dependencias em `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`;
- warning em `web/src/pages/paginasAdmin/inventarioAdmin/inventarioAdmin.jsx`.

Impacto:

- o baseline nao esta limpo para CI;
- Rede e Chamados podem manter closure/config antigos ao trocar contexto de preview sem remontar a tela.

Decisao:

- corrigir hooks e fazer `npm run lint` passar.

#### P2.2. Bundle do frontend esta pesado

Evidencia:

- `npm run build` em `web` gera aviso para chunk JS minificado acima de 500 kB;
- assets de login/background e logo Microsoft tambem sao grandes.

Impacto:

- primeira carga e apresentacao em rede instavel podem sofrer;
- nao bloqueia funcionalidade, mas afeta percepcao de qualidade.

Decisao:

- tratar depois dos P0/P1 com code splitting e otimizacao de imagens.

## 5. Proposta de produto

## 5.1. Area de conta do usuario final

Criar uma rota autenticada do portal, por exemplo `/app/conta`, acessivel pela sidebar e por menu de usuario.

Primeira entrega:

- mostrar nome, e-mail, empresa e papel em modo somente leitura quando esses campos nao forem editaveis;
- permitir alterar a propria senha com senha atual, nova senha e confirmacao;
- validar tamanho e politica de senha no backend;
- invalidar ou rotacionar sessao conforme estrategia de auth escolhida;
- exibir estados de sucesso, erro, carregamento e expiracao de sessao;
- nao permitir que o usuario informe outro `userId` para alterar senha de terceiros.

Entrega seguinte recomendada:

- recuperacao de senha fora de sessao;
- opcao de encerrar outras sessoes;
- trilha de auditoria apropriada para eventos de seguranca da conta;
- fluxo de primeiro acesso com troca de senha temporaria.

## 5.2. Preview de apresentacao

O preview deve continuar sinalizado como admin, mas o conteudo interno das paginas de cliente deve refletir o cliente real.

Regras:

- ocultar controles administrativos dentro das paginas reutilizadas;
- bloquear mutacoes acidentais no modo "visualizar como cliente";
- manter `companyId` do preview em todas as consultas;
- usar dados da empresa visualizada em rotulos que hoje leem apenas `user.company_name`.

## 5.3. Baseline de seguranca

O baseline minimo apos esta rodada deve conter:

- dependencias auditadas e atualizadas;
- autorizacao com revogacao de role/escopo em tempo aceitavel;
- sem senhas bootstrap literais rastreadas;
- login com rate limit;
- CORS de producao explicitamente configurado;
- security headers;
- testes de isolamento por empresa em endpoints de cliente.

## 6. Requisitos funcionais

1. Um cliente autenticado deve abrir sua area de conta no portal.
2. Um cliente autenticado deve alterar apenas a propria senha.
3. O admin deve continuar podendo criar, bloquear e redefinir usuarios.
4. Usuario bloqueado nao deve continuar usando rotas autenticadas.
5. Usuario que perdeu role admin nao deve continuar executando rotas admin apenas por portar JWT antigo.
6. O preview de uma empresa deve continuar carregando somente dados daquela empresa.
7. O preview nao deve mostrar controles admin-only dentro do conteudo que pretende representar o cliente.
8. Erros de login, troca de senha e download/upload devem ter feedback claro sem expor segredos.

## 7. Requisitos nao funcionais

1. **Isolamento:** toda leitura de dados de cliente deve ter escopo de empresa verificavel.
2. **Seguranca:** senha, token e secret de integracao nao devem ser logados nem retornados ao browser.
3. **Compatibilidade:** login atual, painel admin e modulos do cliente nao podem regredir.
4. **Auditabilidade:** mutacoes administrativas relevantes devem manter trilha de auditoria.
5. **Operacao:** configuracao insegura por omissao deve ser evitada em producao.
6. **Qualidade:** build, TypeScript, lint e audit devem ter criterio explicito de aceite.

## 8. Contratos tecnicos recomendados

### 8.1. Conta

Endpoints sugeridos:

- `GET /api/auth/me` ou `GET /api/account/me`;
- `POST /api/auth/change-password` ou `POST /api/account/change-password`.

Regras do change password:

- derivar o ator do JWT/session, nunca do body;
- exigir reautenticacao/senha atual se a estrategia de auth adotada suportar;
- rejeitar senha curta/fraca conforme politica definida;
- retornar mensagem neutra e status apropriado;
- registrar evento de seguranca sem guardar senha.

### 8.2. Autorizacao

No middleware autenticado:

- validar token;
- carregar perfil atual minimo (`id`, `role`, `company_id`, `status`);
- rejeitar perfil ausente ou bloqueado;
- disponibilizar ao request o perfil atual usado nas verificacoes seguintes.

Se for adotado cache, definir TTL curto e invalidacao ao bloquear/alterar role.

### 8.3. Escopo de empresa

Para rotas `/api/client/*`:

- client comum usa exclusivamente `company_id` do perfil atual;
- admin em preview envia `company_id` e deve ter o alvo validado;
- admin sem `company_id` deve receber erro nas rotas que representam experiencia de cliente;
- visoes globais devem viver em rotas `/api/admin/*`.

## 9. Criterios de aceite

1. `npm run lint` em `web` passa.
2. `npm run build` em `web` passa.
3. `npx tsc --noEmit` em `backend` passa.
4. `npm audit --omit=dev --audit-level=high` nao deixa vulnerabilidade alta/critica de producao sem decisao documentada.
5. Usuario cliente troca a propria senha pelo portal e nao consegue trocar senha de outra conta.
6. Admin rebaixado/bloqueado deixa de acessar rotas admin conforme a regra de revogacao definida.
7. Preview de cliente nao exibe o painel de selecao admin de licencas Microsoft 365.
8. Rotas de cliente cobertas por teste nao retornam dados de outra empresa.
9. Senhas bootstrap literais deixam de existir nos scripts rastreados.
10. Login possui defesa de taxa e producao nao usa CORS wildcard por omissao.

## 10. Fora do escopo desta especificacao

- pentest externo completo;
- remodelar toda a identidade visual do portal;
- substituir Supabase como provedor;
- implementar MFA nesta primeira rodada;
- criar um modulo completo de notificacoes ou preferencia de alertas do cliente.

MFA, recuperacao de senha e otimizacao de bundle devem permanecer no backlog visivel depois que a base acima estiver fechada.
