# Especificação: Melhorias de Visualização GLPI e Métricas de SLA

## 1. Título
Melhoria na Visualização, Filtros, Exportação de Relatórios e Correção da Métrica de SLA de Chamados GLPI

## 2. Contexto / Objetivo
O painel de chamados atual precisa de uma evolução na forma como os dados são consumidos pelo cliente. O foco não é a edição ou criação de chamados, mas sim proporcionar uma **análise e visualização aprofundada**. Além disso, a métrica de SLA atual não está refletindo a realidade ou não funciona corretamente e precisa ser corrigida.

O objetivo é:
- Garantir que os dados de SLA venham corretos do GLPI.
- Permitir que o cliente visualize os detalhes completos de um chamado (descrição, linha do tempo/acompanhamentos) em uma interface limpa (ex: Drawer).
- Adicionar filtros avançados (busca textual, período de datas, requerente, etc.).
- Permitir a exportação dos dados filtrados para relatórios personalizados (ex: CSV ou Excel).

## 3. Requisitos Técnicos
- **Backend (Node.js/Fastify):** 
  - Ajuste na sincronização (`glpi-service.ts`) para mapear os dados reais de SLA e trazer a descrição completa e acompanhamentos dos chamados (ou criar endpoint para buscar sob demanda).
- **Frontend (React/Tailwind):** 
  - Atualização do `chamados.jsx` com novos componentes de filtro avançado.
  - Adição de função para Exportar Relatório (CSV).
  - Criação de um Componente para visualização detalhada (`TicketDetailDrawer.jsx`).

## 4. Áreas Afetadas
- **Frontend:**
  - `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - Criação de `TicketDetailDrawer.jsx`
- **Backend:**
  - `backend/src/services/glpi-service.ts`
  - `backend/src/routes/client/glpi-routes.ts`

## 5. Critérios de Aceite
- O indicador de "SLA Cumprido" no dashboard mostra o valor real sincronizado do GLPI.
- A tabela de chamados possui filtros avançados (Busca, Data, etc) e os chamados reagem a esses filtros.
- Ao clicar em um chamado na tabela, abre-se uma aba lateral (Drawer) ou Modal com os detalhes ricos (descrição completa, histórico de tratativas) do chamado de forma *somente-leitura*.
- Há um botão de "Exportar Relatório" que baixa um arquivo CSV (ou planilha) contendo a lista de chamados que estão sendo exibidos após a aplicação dos filtros.
