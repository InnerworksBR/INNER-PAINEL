# Tasks — Detalhes Técnicos de Equipamentos e Servidores para o Cliente

## Fase 1 — Descoberta e definição do modelo

1. **Inventariar os dados atuais já disponíveis no sistema**
   1.1. Listar todos os campos existentes em `servers`.  
   1.2. Listar todos os campos existentes em `network_devices`.  
   1.3. Identificar quais desses campos já podem compor uma ficha técnica mínima.  
   1.4. Separar claramente métricas operacionais de atributos descritivos.

2. **Mapear quais informações adicionais podem vir do Zabbix**
   2.1. Levantar itens comuns de host que possam fornecer sistema operacional, versão, modelo, fabricante, serial, firmware e virtualização.  
   2.2. Verificar como esses itens variam entre templates de servidores e dispositivos de rede.  
   2.3. Definir quais campos serão suportados já na primeira versão e quais ficarão como evolução futura.  
   2.4. Registrar que a ausência desses itens no Zabbix não pode bloquear o funcionamento da feature.

3. **Definir o modelo conceitual da feature**
   3.1. Adotar uma camada de perfil de ativo separada das tabelas operacionais atuais.  
   3.2. Definir a entidade central, por exemplo `asset_profiles`.  
   3.3. Definir a ligação entre perfil e origem usando:
   - `source_type` (`server`, `network_device`);
   - `source_id`;
   - `company_id`.  
   3.4. Definir quais campos são automáticos, manuais e mistos.

4. **Definir o contrato de precedência entre dados automáticos e manuais**
   4.1. Estabelecer que dados manuais podem sobrescrever dados automáticos quando necessário.  
   4.2. Definir como registrar campos alterados manualmente.  
   4.3. Definir comportamento de uma nova sync quando já existir override manual.  
   4.4. Documentar quais campos podem sempre ser atualizados automaticamente e quais exigem preservação de curadoria.

5. **Definir a política de visibilidade para cliente**
   5.1. Criar o conceito de `customer_visible`.  
   5.2. Decidir se novos ativos entram por padrão como visíveis ou não visíveis.  
   5.3. Recomendação inicial: começar como **não visível** até revisão do admin, para evitar exposição acidental.  
   5.4. Definir como isso afeta listagens e endpoints de detalhe do cliente.

## Fase 2 — Banco de dados e backend estrutural

6. **Criar migration da nova tabela de perfis de ativo**
   6.1. Criar tabela `asset_profiles` ou nome equivalente.  
   6.2. Adicionar chaves para `company_id`, `source_type` e `source_id`.  
   6.3. Adicionar campos técnicos, funcionais, de visibilidade e governança.  
   6.4. Criar índices úteis por empresa, origem e visibilidade.  
   6.5. Definir unicidade adequada para impedir duas fichas para o mesmo ativo-origem.

7. **Definir estratégia para dados automáticos e manuais**
   7.1. Escolher entre colunas explícitas + flags de override ou JSONB complementar.  
   7.2. Recomendação prática:
   - colunas explícitas para os campos principais exibidos com frequência;
   - JSONB para metadados menos estáveis ou futuros.  
   7.3. Garantir que a estratégia escolhida suporte evolução sem quebra de schema a cada campo novo.

8. **Criar serviço de merge entre telemetria e perfil de ativo**
   8.1. Implementar lógica que combine:
   - dados do host/dispositivo sincronizado;
   - dados automáticos extraídos do Zabbix;
   - overrides manuais cadastrados pelo admin.  
   8.2. Centralizar essa regra em serviço dedicado, evitando duplicação em rotas.  
   8.3. Garantir previsibilidade de leitura para frontend cliente e admin.

9. **Estender a sincronização de servidores via Zabbix**
   9.1. Identificar e coletar itens adicionais relevantes por host.  
   9.2. Mapear valores detectados para o perfil do ativo.  
   9.3. Criar perfil automaticamente quando um servidor novo for sincronizado.  
   9.4. Atualizar apenas campos automáticos permitidos.  
   9.5. Preservar alterações manuais existentes.

10. **Estender a sincronização de rede via Zabbix**
   10.1. Identificar itens adicionais aplicáveis a switches, roteadores, firewalls e APs.  
   10.2. Tentar extrair fabricante, modelo e firmware quando disponíveis.  
   10.3. Criar perfil automaticamente quando um dispositivo novo for sincronizado.  
   10.4. Preservar complementos manuais.

11. **Criar endpoints administrativos de inventário**
   11.1. Listar perfis por empresa.  
   11.2. Buscar detalhe de um perfil.  
   11.3. Atualizar ficha técnica.  
   11.4. Atualizar `customer_visible`.  
   11.5. Filtrar por tipo de ativo, origem, visibilidade e status de preenchimento.  
   11.6. Registrar auditoria para alterações relevantes.

12. **Criar endpoints de cliente para detalhe de ativo**
   12.1. Criar leitura de detalhe de servidor visível ao cliente.  
   12.2. Criar leitura de detalhe de equipamento de rede visível ao cliente.  
   12.3. Aplicar sempre escopo por empresa.  
   12.4. Rejeitar ativos ocultos mesmo que o ID seja conhecido.  
   12.5. Garantir respostas adequadas para item inexistente ou sem permissão.

13. **Revisar listagens atuais de cliente**
   13.1. Decidir se ativos ocultos deixam de aparecer completamente ou aparecem sem clique de detalhe.  
   13.2. Recomendação inicial: se o ativo não deve ser exposto ao cliente, ele não deve aparecer na listagem do cliente.  
   13.3. Ajustar endpoints/listagens de servidores e rede conforme a política escolhida.

## Fase 3 — Experiência administrativa

14. **Definir o ponto de entrada da feature no admin**
   14.1. Criar uma nova seção/menu `Inventário` ou nome equivalente.  
   14.2. Avaliar se também haverá atalho a partir da empresa selecionada.  
   14.3. Garantir que a navegação permita trabalhar por empresa com rapidez.

15. **Construir a listagem administrativa de ativos**
   15.1. Exibir ativo, empresa, tipo, origem, visibilidade, última sync e última revisão.  
   15.2. Adicionar filtros por empresa, tipo, visibilidade e preenchimento.  
   15.3. Sinalizar ativos com cadastro incompleto.  
   15.4. Permitir busca por nome, IP, modelo ou hostname.

16. **Construir o formulário de edição da ficha técnica**
   16.1. Separar blocos de:
   - identificação;
   - técnica;
   - função no ambiente;
   - visibilidade.  
   16.2. Mostrar, quando possível, a origem de cada campo.  
   16.3. Permitir complementar dados ausentes do Zabbix.  
   16.4. Permitir corrigir nomenclatura exibida ao cliente.  
   16.5. Permitir marcar revisão manual.

17. **Adicionar controle de visibilidade por ativo**
   17.1. Implementar toggle claro de “Disponível para o cliente”.  
   17.2. Pedir confirmação quando ocultar um ativo que já estava visível.  
   17.3. Registrar auditoria da mudança.  
   17.4. Refletir imediatamente essa alteração nas rotas de cliente.

18. **Adicionar indicadores de qualidade cadastral**
   18.1. Criar no admin uma noção de completude da ficha.  
   18.2. Exemplo: `Sem descrição`, `Sem modelo`, `Sem finalidade`, `Completo`.  
   18.3. Usar isso para o time priorizar enriquecimento de inventário.

## Fase 4 — Experiência do cliente

19. **Tornar servidores clicáveis na tela atual**
   19.1. Fazer o nome do servidor abrir a ficha técnica.  
   19.2. Definir se a abertura será por modal, drawer ou página.  
   19.3. Recomendação inicial: usar drawer/modal para preservar o contexto operacional da tela.  
   19.4. Garantir acessibilidade básica de clique e teclado.

20. **Tornar equipamentos de rede clicáveis na tela atual**
   20.1. Fazer o nome do equipamento abrir a ficha técnica.  
   20.2. Usar o mesmo padrão visual escolhido para servidores.  
   20.3. Reaproveitar componente base de detalhe sempre que possível.

21. **Criar componente de detalhe de ativo reutilizável**
   21.1. Exibir cabeçalho com nome, tipo, status, ambiente e criticidade.  
   21.2. Exibir seção “O que é / para que serve”.  
   21.3. Exibir ficha técnica com campos condicionais.  
   21.4. Exibir telemetria atual quando aplicável.  
   21.5. Exibir última sincronização e última revisão.  
   21.6. Tratar ausência parcial de dados com elegância.

22. **Definir diferenças de exibição por tipo de ativo**
   22.1. Para servidor/VM, priorizar SO, virtualização, CPU, memória e armazenamento.  
   22.2. Para rede, priorizar fabricante, modelo, firmware, IP, localização e função.  
   22.3. Para tipos genéricos, usar layout mais neutro sem campos irrelevantes.

23. **Tratar estados vazios e restrições de visibilidade**
   23.1. Ativo sem ficha suficiente.  
   23.2. Ativo não visível ao cliente.  
   23.3. Ativo removido ou indisponível.  
   23.4. Erro ao carregar detalhe.

## Fase 5 — Segurança, qualidade e auditoria

24. **Garantir isolamento multi-tenant**
   24.1. Todas as consultas devem ser filtradas por `company_id`.  
   24.2. O cliente não pode consultar detalhe de ativo de outra empresa por ID conhecido.  
   24.3. O admin em modo preview deve respeitar a empresa selecionada.  
   24.4. Testar servidores e rede separadamente.

25. **Adicionar testes de backend**
   25.1. Cliente acessa detalhe do próprio ativo visível.  
   25.2. Cliente recebe bloqueio para ativo oculto.  
   25.3. Cliente não acessa ativo de outra empresa.  
   25.4. Admin atualiza ficha e visibilidade.  
   25.5. Nova sincronização preserva override manual.  
   25.6. Novo ativo sincronizado gera perfil automaticamente.

26. **Adicionar testes de frontend**
   26.1. Clique em servidor abre detalhe.  
   26.2. Clique em equipamento de rede abre detalhe.  
   26.3. Campos aparecem/ocultam conforme disponibilidade.  
   26.4. Estados vazios são exibidos corretamente.  
   26.5. Controle de visibilidade no admin funciona como esperado.

27. **Adicionar auditoria administrativa**
   27.1. Registrar alteração de ficha técnica.  
   27.2. Registrar mudança de visibilidade.  
   27.3. Registrar, se desejado, revisão manual concluída.  
   27.4. Garantir que logs não exponham segredos ou dados sensíveis desnecessários.

28. **Revisar copy e linguagem para o cliente**
   28.1. Evitar descrições excessivamente internas ou jargão bruto.  
   28.2. Padronizar títulos como `Para que serve`, `Ficha técnica`, `Última atualização`.  
   28.3. Garantir que a tela ajude o cliente a entender, não apenas a inspecionar.

## Fase 6 — Aceite final

29. **Validar critérios funcionais**
   29.1. Cliente abre detalhes de servidor.  
   29.2. Cliente abre detalhes de equipamento de rede.  
   29.3. Admin controla visibilidade.  
   29.4. Admin complementa dados manuais.  
   29.5. Dados automáticos aparecem quando disponíveis.

30. **Validar critérios técnicos**
   30.1. Overrides manuais sobrevivem a novas sincronizações.  
   30.2. A modelagem suporta vários tipos de ativo.  
   30.3. Não há duplicidade indevida de fichas.  
   30.4. O modelo continua extensível para novos campos futuros.

31. **Validar critérios de segurança e produto**
   31.1. Itens ocultos não vazam ao cliente.  
   31.2. O cliente vê somente ativos da própria empresa.  
   31.3. A ficha técnica é compreensível sem mediação do time técnico.  
   31.4. O admin consegue manter o inventário com esforço razoável.

## Ordem recomendada de execução

1. Tasks 1–5 para fechar o desenho de dados e regras.  
2. Tasks 6–13 para criar fundação segura no backend.  
3. Tasks 14–18 para entregar a curadoria administrativa.  
4. Tasks 19–23 para liberar a experiência do cliente.  
5. Tasks 24–31 para endurecer qualidade, segurança e aceite.

## Definição de pronto

A feature só deve ser considerada concluída quando:

- o cliente puder entender claramente o que é cada ativo relevante;
- o admin puder decidir o que fica visível e complementar a ficha;
- dados automáticos e manuais coexistirem sem se atropelar;
- o sistema permanecer seguro, multi-tenant e fácil de evoluir.
