# Checklist de Tarefas: Melhorias GLPI e SLA

- [x] 1. **Backend:** Investigar a API do GLPI e corrigir o mapeamento da métrica de SLA no `glpi-service.ts` (garantir que `sla_state` ou prazos reais e descrição estejam sendo lidos e salvos corretamente).
- [x] 2. **Backend:** Criar endpoint em `glpi-routes.ts` (`GET /tickets/:id`) para buscar detalhes completos e histórico/acompanhamentos de um chamado específico (apenas leitura). *(Pode ser feito em paralelo com a tarefa 3 usando subagente)*.
- [x] 3. **Frontend:** Adicionar novos controles de Filtros Avançados (Busca por título/ID, intervalo de datas) e a função de Exportar para CSV/Excel no arquivo `chamados.jsx`. *(Pode ser feito em paralelo com a tarefa 2 usando subagente)*.
- [x] 4. **Frontend:** Criar o componente `TicketDetailDrawer.jsx` para exibir a linha do tempo, histórico e detalhes de um chamado. Integrar o clique na tabela para abrir este drawer.
- [x] 5. **Integração/Testes:** Validar fluxo completo: a exatidão do SLA, a performance dos filtros, o arquivo exportado e a correta exibição dos detalhes do chamado.
