# Tasks — Implementação da Visualização do Cliente dentro do Admin

## Fase 1 — Levantamento e desenho técnico

1. **Inventariar o fluxo atual de autenticação e autorização**
   1.1. Confirmar como `user.role` e `user.company_id` chegam no frontend e backend.  
   1.2. Registrar quais rotas já aceitam admin e quais dependem exclusivamente de `user.company_id`.  
   1.3. Identificar se existe alguma rota de cliente que, para admin, hoje retorna dados globais sem filtro.

2. **Mapear todas as páginas do portal do cliente e suas dependências de API**
   2.1. Listar as páginas de cliente existentes: Dashboard, MS365, Servidores, Rede, Documentação e Chamados.  
   2.2. Para cada página, identificar os endpoints consumidos.  
   2.3. Para cada endpoint, registrar se ele já suporta filtro por empresa e como isso acontece.  
   2.4. Marcar endpoints que precisarão receber `company_id` em modo preview.

3. **Definir o contrato único de escopo por empresa**
   3.1. Escolher o formato oficial para o preview admin enviar o contexto da empresa, preferencialmente `company_id` em query string ou parâmetro de rota conforme o endpoint.  
   3.2. Definir a regra de prioridade:
   - cliente comum → sempre usa `user.company_id` do token;
   - admin em preview → usa `company_id` explícito;
   - admin fora do preview → manter comportamento atual apenas onde a visão global for realmente desejada.  
   3.3. Documentar quais endpoints devem rejeitar admin sem `company_id` quando usados em contexto de preview.

4. **Definir a arquitetura frontend do preview**
   4.1. Decidir a rota final, por exemplo `/admin/empresas/:companyId/preview`.  
   4.2. Decidir se haverá um novo `ClientPreviewLayout` ou uma composição controlada do layout atual do cliente.  
   4.3. Definir como o `companyId` será disponibilizado às páginas reutilizadas:
   - context dedicado;
   - hook dedicado;
   - ou parâmetro propagado por loader/rota.  
   4.4. Garantir que a solução minimize lógica duplicada dentro das páginas de cliente.

## Fase 2 — Backend e segurança de dados

5. **Criar uma função/helper central de resolução de escopo de empresa**
   5.1. Implementar um helper reutilizável para determinar o `targetCompanyId`.  
   5.2. O helper deve:
   - usar `user.company_id` para usuários não-admin;
   - aceitar `company_id` explícito para admins;
   - validar ausência de escopo quando necessário;
   - retornar erro consistente quando o contexto for inválido.  
   5.3. Preferir reaproveitar o helper em todas as rotas de cliente relevantes para evitar regras divergentes.

6. **Adaptar as rotas de dashboard do cliente**
   6.1. Atualizar `GET /client/dashboard/summary` para aceitar escopo explícito em preview admin.  
   6.2. Garantir que todas as tabelas consultadas sejam filtradas pelo `targetCompanyId` quando aplicável.  
   6.3. Preservar o comportamento atual do cliente comum.

7. **Adaptar as rotas de métricas do cliente**
   7.1. Atualizar `GET /client/metrics/ms365`.  
   7.2. Atualizar `GET /client/metrics/servers`.  
   7.3. Atualizar `GET /client/metrics/servers/events`.  
   7.4. Revisar `GET /client/metrics/servers/:id/history` para confirmar que o isolamento já está correto e ajustar se necessário.  
   7.5. Garantir consistência da regra entre todos os endpoints.

8. **Adaptar as rotas de documentação**
   8.1. Revisar os endpoints em `client/docs-routes.ts`.  
   8.2. Adicionar suporte a `company_id` para admin preview onde hoje só há leitura implícita por usuário.  
   8.3. Confirmar que documentos de outras empresas nunca apareçam no preview.

9. **Adaptar as rotas de GLPI e rede**
   9.1. Revisar `client/glpi-routes.ts`.  
   9.2. Revisar `client/network-routes.ts`.  
   9.3. Aplicar o mesmo contrato de escopo por empresa.  
   9.4. Garantir que filtros, agregações e resumos respeitem a empresa escolhida.

10. **Validar existência da empresa solicitada**
   10.1. Ao entrar em preview ou consultar dados preview, confirmar que o `company_id` existe.  
   10.2. Definir resposta padronizada para empresa inexistente (`404`) e escopo inválido (`400` ou `403`, conforme o caso).  
   10.3. Evitar respostas silenciosas que pareçam “sem dados” quando na verdade a empresa não existe.

11. **Cobrir segurança com testes de backend**
   11.1. Testar cliente comum acessando apenas seus próprios dados.  
   11.2. Testar admin com `company_id` explícito vendo apenas a empresa escolhida.  
   11.3. Testar admin alternando entre duas empresas e recebendo resultados distintos.  
   11.4. Testar empresa inexistente.  
   11.5. Testar ausência de `company_id` nos endpoints que exigirem preview escopado.  
   11.6. Testar tentativa de acesso cruzado em endpoints por ID, como histórico de servidor.

## Fase 3 — Frontend do preview

12. **Adicionar ação de visualização na tabela de empresas**
   12.1. Inserir um novo botão/ícone por linha em `EmpresasAdmin`.  
   12.2. Usar uma ação clara, como `Visualizar portal`.  
   12.3. Navegar para a rota de preview com o ID da empresa selecionada.  
   12.4. Adicionar `title`, rótulo acessível e estilo consistente com os botões existentes.

13. **Criar a rota de preview no roteador**
   13.1. Registrar a nova rota sob `/admin`.  
   13.2. Garantir proteção com `AdminRoute`.  
   13.3. Definir rotas filhas para os módulos do cliente dentro do preview, se necessário.  
   13.4. Manter URLs previsíveis para permitir compartilhamento interno e retorno direto.

14. **Criar o layout de visualização administrativa**
   14.1. Implementar um layout que reaproveite a experiência do cliente sem esconder que o usuário é admin.  
   14.2. Exibir:
   - nome da empresa;
   - indicação de “modo administrativo”;
   - botão de retorno ao painel admin.  
   14.3. Decidir se a sidebar deve ser a do cliente, a do admin, ou uma composição híbrida.  
   14.4. Priorizar fidelidade visual ao portal do cliente, preservando ao mesmo tempo a orientação do operador.

15. **Criar o contexto/hook de empresa em preview**
   15.1. Ler o `companyId` da rota.  
   15.2. Buscar os metadados da empresa necessários para o cabeçalho.  
   15.3. Expor o `previewCompanyId` para as páginas reaproveitadas.  
   15.4. Fornecer estados de carregamento, erro e empresa não encontrada.

16. **Adaptar a camada de chamadas de API do frontend**
   16.1. Definir uma forma consistente de anexar `company_id` nas requisições feitas durante o preview.  
   16.2. Avaliar se isso deve ficar:
   - num helper específico para consultas de cliente;
   - num wrapper de API;
   - ou dentro de hooks de dados por módulo.  
   16.3. Evitar espalhar manualmente `company_id` em dezenas de pontos sem abstração.  
   16.4. Garantir que fora do preview as páginas de cliente continuem funcionando como antes.

17. **Reaproveitar as páginas atuais do cliente no preview**
   17.1. Renderizar Dashboard no preview.  
   17.2. Renderizar MS365 no preview.  
   17.3. Renderizar Servidores no preview.  
   17.4. Renderizar Rede no preview.  
   17.5. Renderizar Documentação no preview.  
   17.6. Renderizar Chamados no preview.  
   17.7. Corrigir qualquer dependência implícita de `user.company_id` no frontend que impeça o reuso.

18. **Tratar estados de UX do preview**
   18.1. Loading inicial do contexto da empresa.  
   18.2. Empresa não encontrada.  
   18.3. Empresa sem dados em determinado módulo.  
   18.4. Erro de carregamento de dados.  
   18.5. Ausência de permissão ou escopo inválido.

19. **Preservar navegação e retorno**
   19.1. Garantir ida fácil de Empresas → Preview.  
   19.2. Garantir retorno fácil de Preview → Empresas/Admin.  
   19.3. Verificar que refresh da página mantém o contexto correto pela URL.  
   19.4. Verificar que deep links internos do preview continuam dentro do preview, e não escapam para `/app`.

## Fase 4 — Qualidade, consistência e testes

20. **Revisar acessibilidade e clareza visual**
   20.1. O botão de visualização deve ter rótulo acessível.  
   20.2. O banner de preview deve ser legível e persistente.  
   20.3. A navegação precisa indicar claramente onde o usuário está.  
   20.4. Confirmar contraste e responsividade mínima.

21. **Executar testes manuais ponta a ponta**
   21.1. Entrar como admin.  
   21.2. Abrir preview da empresa A.  
   21.3. Validar todos os módulos.  
   21.4. Voltar e abrir preview da empresa B.  
   21.5. Confirmar que os dados mudaram conforme a empresa.  
   21.6. Entrar como cliente comum e confirmar ausência de regressão.

22. **Adicionar testes automatizados de frontend, se a base do projeto suportar**
   22.1. Testar renderização do botão de preview.  
   22.2. Testar roteamento com `companyId`.  
   22.3. Testar exibição do banner de modo preview.  
   22.4. Testar anexação do `company_id` nas chamadas enquanto o preview está ativo.  
   22.5. Testar que chamadas fora do preview não recebem esse escopo extra indevidamente.

23. **Revisar logs e auditoria**
   23.1. Avaliar se a abertura de preview deve gerar evento de auditoria.  
   23.2. Se sim, definir ação, entidade, empresa e metadados mínimos.  
   23.3. Garantir que ações de simples visualização não se confundam com ações de alteração.

24. **Atualizar documentação técnica interna**
   24.1. Documentar a nova rota de preview.  
   24.2. Documentar a regra de escopo para admins em endpoints de cliente.  
   24.3. Registrar o fluxo para futuros mantenedores adicionarem novos módulos ao preview sem quebrar o isolamento.

## Fase 5 — Validação de aceite

25. **Validar critérios de aceite funcionais**
   25.1. Ação de preview disponível por empresa.  
   25.2. Visualização fiel dos módulos do cliente.  
   25.3. Retorno simples ao admin.  
   25.4. Empresa atual sempre identificável.

26. **Validar critérios de aceite de segurança**
   26.1. Nenhum dado cruzado entre empresas.  
   26.2. Admin em preview vê somente a empresa escolhida.  
   26.3. Cliente comum continua isolado por JWT.  
   26.4. Endpoints por ID continuam protegidos.

27. **Validar critérios de aceite de manutenção**
   27.1. As telas do cliente foram reaproveitadas em vez de duplicadas.  
   27.2. A lógica de escopo ficou centralizada.  
   27.3. A solução permite adicionar novos módulos no futuro com baixo atrito.

## Ordem recomendada de execução

1. Tasks 1–4 para fechar arquitetura.  
2. Tasks 5–11 para resolver segurança e contrato de dados primeiro.  
3. Tasks 12–19 para construir a experiência visual.  
4. Tasks 20–24 para endurecer qualidade.  
5. Tasks 25–27 para aceite final.

## Definição de pronto

A implementação só deve ser considerada concluída quando:

- o admin conseguir abrir o preview por empresa;
- todos os módulos reutilizados carregarem com escopo correto;
- o preview estiver claramente identificado;
- clientes comuns não sofrerem regressão;
- houver cobertura de testes suficiente para impedir vazamento multi-tenant acidental.
