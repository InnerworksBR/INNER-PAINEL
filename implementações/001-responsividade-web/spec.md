# Responsividade Web

## Contexto / Objetivo
O painel web atual (INNER_PAINEL) não é responsivo e tem o layout quebrado em dispositivos móveis. O objetivo desta feature é implementar a responsividade em todo o sistema web, garantindo que as páginas sejam usáveis tanto em desktop quanto em telas menores (tablets e smartphones), proporcionando uma boa experiência de usuário em todas as plataformas.

## Requisitos Técnicos
- Utilizar as classes utilitárias de responsividade do **Tailwind CSS** (ex: `sm:`, `md:`, `lg:`).
- Não adicionar novas bibliotecas externas se o Tailwind CSS puder resolver.
- Utilizar ícones existentes (`lucide-react`) para o menu mobile.
- Criar um controle para o menu (hamburger menu) para o `Sidebar` e `SidebarAdmin` em telas pequenas, com uma navbar no topo para abrigá-lo ou um toggle.
- Ajustar os layouts principais (`AdminLayout`, `layout.jsx`, `ClientPreviewLayout`) para acomodarem o menu mobile e esconder a sidebar lateral em telas menores.
- Ajustar o espaçamento e disposição das páginas, garantindo que grids e flexboxes se adaptem (ex: `flex-col` em mobile, `flex-row` em desktop).

## Áreas Afetadas
- Frontend (React / Vite)
- Layouts (`src/layouts/*`)
- Componentes de Sidebar (`src/components/Sidebar.jsx`, `src/components/SidebarAdmin.jsx`)
- Páginas dentro de `src/pages/` (Ajustes de grid, paddings, e visualização de dados).

## Critérios de Aceite
- O painel deve poder ser acessado e utilizado de forma responsiva em dispositivos móveis (largura menor que 768px).
- O menu lateral deve ser acessível de forma otimizada para mobile (ex: header superior com botão para abrir a sidebar).
- Os dashboards e tabelas de dados devem ter adaptação adequada (como scroll horizontal ou stack vertical) no tamanho da tela.
- A experiência original de uso em desktop não deve ser impactada negativamente.
