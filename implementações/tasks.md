# Tasks - Batidao de prontidao do Portal Inner

## Ordem de ataque

Priorizar nesta ordem:

1. proteger a base de autenticacao e dependencias;
2. entregar conta/troca de senha para o usuario final;
3. deixar preview e isolamento prontos para apresentacao;
4. endurecer HTTP, uploads e testes;
5. limpar qualidade e performance.

## Fase 0 - Preparar baseline e evidencia

1. **Registrar o estado atual da rodada**
   1.1. Preservar a saida dos comandos ja executados em 22/05/2026.
   1.2. Anotar que `web` build passou com warning de chunk grande.
   1.3. Anotar que `web` lint falhou em hooks/contexto de preview.
   1.4. Anotar que backend TypeScript passou.
   1.5. Anotar que backend e web `npm audit --omit=dev --audit-level=high` falharam.

2. **Definir criterio da apresentacao**
   2.1. Escolher quais empresas/dados serao demonstrados.
   2.2. Validar preview de cada empresa que sera aberta ao vivo.
   2.3. Evitar demonstrar fluxos que ainda tenham acao admin misturada ao conteudo do cliente.
   2.4. Preparar plano de fallback para modulos sem dados sincronizados.

## Fase 1 - P0 seguranca de autenticacao e supply chain

3. **Atualizar dependencias vulneraveis do backend**
   3.1. Atualizar `axios`, `fastify`, dependencias transitivas corrigidas e `@fastify/jwt` conforme compatibilidade do projeto.
   3.2. Ler notas de upgrade do JWT antes de aplicar major version.
   3.3. Rodar login, `/auth/validate`, rotas admin e rotas client apos o upgrade.
   3.4. Rodar `npm audit --omit=dev --audit-level=high` novamente em `backend`.
   3.5. Documentar qualquer alerta que permanecer com justificativa e versao alvo.

4. **Atualizar dependencias vulneraveis do frontend**
   4.1. Atualizar `axios` e transitivas corrigiveis em `web`.
   4.2. Rodar build e lint apos lockfile mudar.
   4.3. Rodar `npm audit --omit=dev --audit-level=high` novamente em `web`.

5. **Corrigir revogacao de role e escopo no middleware JWT**
   5.1. Alterar `backend/src/plugins/jwt.ts` para carregar o perfil atual minimo.
   5.2. Validar perfil inexistente, `status`, `role` e `company_id`.
   5.3. Nao confiar em `role` e `company_id` antigos do token para autorizacao final.
   5.4. Atualizar o objeto de usuario disponivel no request com o perfil atual, ou criar helper unico equivalente.
   5.5. Garantir que `verifyAdmin` use esse estado atualizado.
   5.6. Definir estrategia de cache/revogacao se a consulta por request for otimizada.

6. **Testar revogacao**
   6.1. Emitir token de admin.
   6.2. Alterar o perfil para client e provar que rota `/api/admin/*` passa a falhar.
   6.3. Bloquear usuario com token valido e provar que rotas autenticadas falham.
   6.4. Alterar `company_id` de cliente e provar que leituras seguintes usam o escopo novo.
   6.5. Cobrir o caso de perfil removido/inexistente.

7. **Remover senha bootstrap literal**
   7.1. Refatorar `backend/create_users.js` para nao conter senha fixa.
   7.2. Preferir senha passada por env/CLI ou geracao de credencial temporaria unica.
   7.3. Evitar imprimir senha em log permanente.
   7.4. Inventariar ambientes onde o script foi executado.
   7.5. Rotacionar as contas bootstrap afetadas.

## Fase 2 - Conta do usuario final

8. **Definir UX minima da area de conta**
   8.1. Criar rota do cliente, por exemplo `/app/conta`.
   8.2. Adicionar entrada acessivel na sidebar/menu do portal.
   8.3. Mostrar nome, e-mail, empresa e papel.
   8.4. Criar formulario de troca de senha com:
   - senha atual;
   - nova senha;
   - confirmacao;
   - mostrar/ocultar senha;
   - validacao e feedback de sucesso/erro.
   8.5. Decidir se nome completo sera editavel nesta primeira entrega.

9. **Criar API de conta**
   9.1. Criar endpoint `me` para retornar apenas dados seguros do usuario autenticado, se o frontend nao puder usar o perfil atual com seguranca suficiente.
   9.2. Criar endpoint de troca de senha derivando o usuario do request autenticado.
   9.3. Nao aceitar `userId` no body para trocar senha.
   9.4. Revalidar senha atual antes da troca conforme o fluxo Supabase adotado.
   9.5. Aplicar a mesma politica minima de senha da criacao/reset admin, revisando se 8 caracteres ainda e suficiente para o produto.
   9.6. Tratar sessao expirada e erro de credencial sem vazar detalhe sensivel.

10. **Criar tela de conta no frontend**
   10.1. Criar pagina de conta no namespace de paginas client.
   10.2. Registrar rota protegida em `web/src/rotas/rotas.jsx`.
   10.3. Adicionar navegacao a partir de `web/src/components/Sidebar.jsx`.
   10.4. Implementar estados loading, erro, submit em andamento e sucesso.
   10.5. Limpar campos de senha apos sucesso.
   10.6. Revisar texto para o cliente entender o que mudou.

11. **Cobrir troca de senha**
   11.1. Testar cliente trocando a propria senha.
   11.2. Testar senha atual invalida.
   11.3. Testar nova senha curta e confirmacao divergente.
   11.4. Testar que outro usuario nao pode ser alvo da rota.
   11.5. Testar comportamento da sessao apos a troca.

12. **Criar backlog explicito da conta**
   12.1. Recuperacao de senha fora de sessao.
   12.2. Primeiro acesso com troca obrigatoria de senha temporaria.
   12.3. Encerrar outras sessoes.
   12.4. MFA, se aprovado para o produto.

## Fase 3 - Isolamento e preview pronto para demonstracao

13. **Fechar contrato das rotas de cliente para admin**
   13.1. Revisar `backend/src/services/company-scope-service.ts`.
   13.2. Tornar explicito quais endpoints `/api/client/*` exigem `company_id` para admin.
   13.3. Retornar erro para admin sem escopo nas rotas de experiencia do cliente.
   13.4. Manter visoes globais somente em endpoints `/api/admin/*`.
   13.5. Garantir que endpoint por ID confirme o recurso pertence ao escopo resolvido.

14. **Cobrir isolamento multi-tenant**
   14.1. Criar fixture com duas empresas e dados distintos.
   14.2. Testar Dashboard, MS365, Servidores, Rede, Documentos e GLPI por cliente comum.
   14.3. Testar admin preview com `company_id` da empresa A e B.
   14.4. Testar admin sem escopo recebendo erro onde aplicavel.
   14.5. Testar downloads de documentos e historicos por ID fora do escopo.
   14.6. Testar detalhes de asset invisivel ao cliente.

15. **Remover controles admin do preview**
   15.1. Em `web/src/pages/paginasClient/Microsoft/microsoft.jsx`, esconder a selecao de licencas admin quando `useClientPreview()` indicar modo preview.
   15.2. Nao mostrar perfil `Administrador` como informacao do cliente no conteudo preview.
   15.3. Usar empresa do preview em rotulos de tenant quando disponivel.
   15.4. Revisar outras paginas reutilizadas para mutacoes admin-only.
   15.5. Decidir se preview tera um modo futuro "operar como admin" separado do modo de demonstracao.

16. **Corrigir estado do preview e polling**
   16.1. Corrigir memoizacao de `useClientRequestConfig` em `web/src/context/ClientPreviewContext.jsx`.
   16.2. Corrigir dependencias de `useEffect`/callbacks em `Rede`.
   16.3. Corrigir dependencias de `useEffect`/callbacks em `ChamadosGLPI`.
   16.4. Revisar troca de empresa no preview sem refresh completo.
   16.5. Rodar `npm run lint` ate zerar erro e warnings relevantes.

17. **Executar roteiro manual de apresentacao**
   17.1. Login como admin.
   17.2. Abrir Empresas e entrar no preview da empresa demonstrada.
   17.3. Validar Dashboard, MS365, Servidores, Rede, Documentacao e Chamados.
   17.4. Confirmar que dados e rotulos pertencem a empresa escolhida.
   17.5. Confirmar que preview nao permite alterar licencas por acidente.
   17.6. Login como cliente e abrir a nova area de conta.

## Fase 4 - Endurecimento HTTP e rotas de alto custo

18. **Adicionar defesa de taxa**
   18.1. Registrar plugin de rate limit no Fastify.
   18.2. Aplicar limite mais restritivo em `/api/auth/login`.
   18.3. Avaliar limites para upload, sync manual e endpoints de debug.
   18.4. Definir resposta e logging sem expor existencia de usuario.

19. **Fechar CORS por ambiente**
   19.1. Remover fallback permissivo em producao.
   19.2. Permitir origins esperadas por config explicita.
   19.3. Validar dev local sem tornar producao wildcard.
   19.4. Documentar variaveis obrigatorias de deploy.

20. **Adicionar security headers**
   20.1. Registrar plugin equivalente a Helmet no backend ou na camada HTTP que serve o app.
   20.2. Definir CSP compatvel com Vite build, APIs, imagens e downloads assinados.
   20.3. Avaliar frame policy, referrer policy e HSTS no ambiente HTTPS.
   20.4. Validar login e downloads apos headers entrarem.

21. **Planejar migracao de sessao**
   21.1. Escolher entre cookie HttpOnly no backend ou manter Bearer em storage com risco formalmente aceito e mitigacoes fortes.
   21.2. Se migrar para cookie, revisar CSRF, CORS, refresh/logout e expiracao.
   21.3. Remover token persistido em `localStorage` quando a nova estrategia entrar.
   21.4. Testar logout, expiracao, refresh de tela e preview.

22. **Endurecer upload de documentos**
   22.1. Validar MIME e extensao na rota admin.
   22.2. Confirmar limite por arquivo, quantidade e tamanho total de request.
   22.3. Evitar buffering desnecessario quando houver caminho simples de streaming.
   22.4. Remover do storage arquivos ja enviados se o insert em `documents` falhar.
   22.5. Testar arquivo valido, tipo bloqueado, arquivo acima do limite e falha parcial.

## Fase 5 - Testes e observabilidade

23. **Criar base automatizada de testes do backend**
   23.1. Adicionar script de teste no `backend/package.json`.
   23.2. Cobrir auth middleware, `verifyAdmin`, resolve company scope e change password.
   23.3. Cobrir leitura/download de documentos por escopo.
   23.4. Cobrir sync/manual endpoints com permissao admin.
   23.5. Evitar testes que precisem de credenciais reais de integracao.

24. **Criar testes do frontend para fluxos criticos**
   24.1. Proteger rota de conta.
   24.2. Validar formulario de troca de senha.
   24.3. Validar preview com banner e sem controles admin internos.
   24.4. Validar logout e redirect em 401.
   24.5. Cobrir hooks de request config/polling ao mudar company preview.

25. **Revisar auditoria**
   25.1. Manter logs administrativos de reset de senha, sync, empresa, documentos e inventario.
   25.2. Definir evento para troca de senha do proprio usuario sem guardar segredo.
   25.3. Avaliar log de bloqueio por rate limit.
   25.4. Garantir que erros de integracao nao retornem secrets.

## Fase 6 - Acabamento posterior

26. **Otimizar frontend**
   26.1. Code split de paginas admin/client e graficos pesados.
   26.2. Otimizar imagens grandes usadas no login e logos.
   26.3. Medir bundle depois da mudanca.

27. **Melhorar operacao do portal**
   27.1. Trocar `alert`/`confirm` restantes por feedback consistente onde fizer sentido.
   27.2. Revisar estados vazios e erros dos modulos de cliente.
   27.3. Revisar encoding/textos exibidos no build final.
   27.4. Documentar fluxo de bootstrap sem credencial fixa.

## Checklist de pronto

- [ ] Dependencias de producao altas/criticas corrigidas ou excecao documentada.
- [ ] Senha literal removida de `backend/create_users.js`.
- [ ] Middleware nao deixa role/admin antigo sobreviver apos revogacao definida.
- [ ] Cliente tem pagina de conta e troca de senha.
- [ ] Preview demonstra o cliente sem controles admin internos.
- [ ] Rotas client escopadas para cliente e admin preview com testes negativos.
- [ ] Login possui rate limit e producao nao sobe com CORS wildcard por omissao.
- [ ] `web` build passa.
- [ ] `web` lint passa.
- [ ] `backend` TypeScript passa.
- [ ] Audit de dependencias reexecutado depois dos upgrades.
