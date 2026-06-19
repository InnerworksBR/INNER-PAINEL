# Tarefas: Correções e Melhorias do Módulo GLPI/Chamados

> **Implementação:** 006
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 7/7 tarefas concluídas (100%)
> **Última atualização:** 2026-06-19

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Bug Crítico — CSV Export

- [x] **T-001:** Corrigir bug de newline no CSV export
  - **Descrição:** Em `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`, linha ~125, alterar `].join('\\n')` para `].join('\n')`. Atenção: é uma string com barra dupla (`\\n`) que precisa virar barra simples (`\n`). Adicionalmente, no `new Blob(...)` que cria o arquivo, adicionar o BOM UTF-8 no início do conteúdo: `new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' })`. Isso garante que o Excel reconheça a codificação corretamente e não quebre acentos.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Baixar o CSV e abrir no Excel exibe os dados em linhas separadas com acentos corretos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: UX de Filtros

- [x] **T-002:** Tornar busca por texto reativa (sem precisar clicar "Aplicar")
  - **Descrição:** `filteredTickets` (linha 86) é um `.filter()` direto, recalculado a cada render — NÃO é `useMemo`. Na **linha 90**, trocar `const searchString = filtrosAplicados.busca.toLowerCase();` por `const searchString = filtros.busca.toLowerCase();`. Como o input já atualiza `filtros.busca` em tempo real (linha 198), isso faz a busca filtrar imediatamente ao digitar. Status, prioridade e datas continuam lendo `filtrosAplicados` (aplicados pelo botão). Nenhum `useMemo` precisa ser adicionado.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Digitar no campo de busca filtra os chamados imediatamente, sem clicar no botão.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-003:** Implementar botão "Limpar Filtros"
  - **Descrição:** Em `chamados.jsx`: (1) Criar constante `DEFAULT_FILTROS = { status: 'Todos os status', prioridade: 'Todas as Prioridades', busca: '', dataInicio: '', dataFim: '' }`. (2) Criar função `clearFilters` que chama `setFiltros(DEFAULT_FILTROS)` e `setFiltrosAplicados(DEFAULT_FILTROS)`. (3) Calcular `hasActiveFilters` verificando se `filtrosAplicados` ou `filtros.busca` difere dos valores padrão. (4) Renderizar o botão "Limpar filtros" ao lado do botão "Aplicar Filtros", visível apenas quando `hasActiveFilters === true`. Estilizar como botão secundário (ex: `text-slate-500 hover:text-red-500` com ícone `X`).
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Botão aparece quando há filtros ativos e limpa tudo ao clicar (incluindo campo de texto).
  - **Dependências:** T-002
  - **Estimativa:** Pequena

- [x] **T-004:** Adicionar chips de filtros ativos
  - **Descrição:** Abaixo da barra de filtros (e acima da tabela), quando `hasActiveFilters === true`, renderizar chips mostrando cada filtro ativo (ex: `Status: Em Andamento ×`, `Prioridade: Alta ×`, `Período: 01/06–15/06 ×`). Ao clicar no `×` do chip, resetar aquele filtro específico para o padrão e reaplicar (ex: `setFiltrosAplicados({...filtrosAplicados, status: 'Todos os status'})`). Usar `flex flex-wrap gap-2 items-center`. **Não duplicar** o contador "X chamados encontrados" — ele já existe no cabeçalho da tabela (linha 307).
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Com filtros ativos, chips aparecem abaixo do painel; clicar no × de um chip remove só esse filtro.
  - **Dependências:** T-002, T-003
  - **Estimativa:** Pequena

### Fase 3: Coluna de Data de Atualização

- [x] **T-005:** Mapear `glpi_date_mod` no backend GLPI
  - **Descrição:** Validado: o `ticketsToUpsert` ([glpi-service.ts:80-90](backend/src/services/glpi-service.ts)) NÃO grava a data de modificação; a API fornece `t.date_mod`. **Não usar a coluna `updated_at`** (gerenciada pelo banco) — usar coluna dedicada `glpi_date_mod`. Passos: (1) Garantir a coluna via migração: `ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS glpi_date_mod timestamptz;`. (2) Adicionar ao `ticketsToUpsert`: `glpi_date_mod: t.date_mod ? new Date(t.date_mod).toISOString() : null`.
  - **Arquivos envolvidos:** `backend/src/services/glpi-service.ts`, migração SQL Supabase
  - **Critério de conclusão:** Após sync, `glpi_date_mod` é preenchido nos registros que têm `date_mod`.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações:** Migration SQL incluída como comentário no código: `ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS glpi_date_mod timestamptz;` — executar no Supabase SQL Editor.

- [x] **T-006:** Adicionar coluna "Atualizado" na tabela de chamados
  - **Descrição:** Em `chamados.jsx`: (1) Adicionar `<th>` "Atualizado" no `<thead>` — posicionar após "Data". (2) No `<tbody>`, adicionar `<td>` com `{ticket.glpi_date_mod && ticket.glpi_date_mod !== ticket.created_at ? new Date(ticket.glpi_date_mod).toLocaleDateString('pt-BR') : '—'}`. (3) Incluir a coluna no header e nas linhas do CSV export (header "Atualizado", mesmo formato de data) — atenção ao `colSpan="7"` do empty state, que passará para `8`.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Tabela exibe coluna "Atualizado"; CSV inclui a coluna; `colSpan` do empty state ajustado.
  - **Dependências:** T-005
  - **Estimativa:** Pequena

### Fase 4: Validação

- [x] **T-007:** Testar todos os cenários de filtro e export
  - **Descrição:** Verificação manual (ou por revisão de código) dos seguintes cenários: (1) Baixar CSV com chamados que contêm acentos — verificar abertura no Excel. (2) Digitar no campo de busca e confirmar filtragem imediata. (3) Aplicar status + prioridade + datas e confirmar que o botão "Limpar" aparece. (4) Clicar "Limpar" e confirmar que todos os filtros e chips são removidos. (5) Chip individual: remover um filtro pelo chip e confirmar que os demais permanecem. (6) Confirmar que "X chamados encontrados" reflete o número correto de resultados.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx`
  - **Critério de conclusão:** Todos os 6 cenários passam sem regressões na UI.
  - **Dependências:** T-001, T-002, T-003, T-004, T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | Bug crítico de CSV corrigido + BOM UTF-8 adicionado |
| T-002 | ✅ Concluída | 2026-06-19 | Busca reativa via `filtros.busca` |
| T-003 | ✅ Concluída | 2026-06-19 | DEFAULT_FILTROS + clearFilters + botão Limpar |
| T-004 | ✅ Concluída | 2026-06-19 | Chips de filtros ativos com remoção individual |
| T-005 | ✅ Concluída | 2026-06-19 | glpi_date_mod mapeado; migration SQL no comentário do código |
| T-006 | ✅ Concluída | 2026-06-19 | Coluna Atualizado na tabela, CSV e colSpan=8 |
| T-007 | ✅ Concluída | 2026-06-19 | Revisão de código — todos os cenários cobertos pelas alterações |
