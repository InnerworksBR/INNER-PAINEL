# Especificação: Correções e Melhorias do Módulo GLPI/Chamados

> **ID:** 006
> **Status:** 🟡 Planejada
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Correção de bug crítico que torna o CSV de chamados completamente inutilizável, mais melhorias de UX nos filtros da tela de chamados. O bug do CSV é uma regressão silenciosa: o arquivo gerado tem `\n` literal como texto em vez de quebras de linha reais, fazendo com que o Excel/LibreOffice abra tudo em uma única célula gigante.

---

## 2. Contexto e Motivação

### 2.1 Problemas Encontrados

**Bug Crítico — CSV Export quebrado:**
- `chamados.jsx:125`: `].join('\\n')` usa barra invertida dupla, resultando na string literal `\n` sendo inserida entre as linhas do CSV, em vez de uma quebra de linha real (`\n`).
- O arquivo baixado abre como uma única linha no Excel, tornando o export completamente inútil.

**UX — Filtro de texto não é reativo:**
- A busca por título/ID digita em `filtros.busca` mas só atualiza `filtrosAplicados` ao clicar "Aplicar Filtros".
- O usuário digita, não vê resultado, e tem que clicar no botão — friction desnecessária.
- Status, prioridade e datas fazem sentido ter confirmação explícita; texto de busca deve ser reativo.

**UX — Sem botão "Limpar Filtros":**
- Quando filtros estão ativos, o usuário precisa manualmente resetar cada dropdown e limpar os campos. Não há botão de reset global.

**UX — Coluna de data mostra só `created_at`:**
- A tabela exibe apenas a data de abertura do chamado. A data de resolução/fechamento não é visível, dificultando análise de tempo de atendimento.

**UX — Sem indicador de filtros ativos:**
- Quando filtros estão ativos, não há feedback visual no cabeçalho do painel informando quantos filtros estão aplicados.

### 2.2 Impacto

- O CSV exportado é inutilizável para qualquer cliente — bug de alta visibilidade.
- A necessidade de clicar "Aplicar" para pesquisa de texto frustra o usuário e parece bug.

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `web/src/pages/paginasClient/ChamadosGLPI/chamados.jsx` | Modificar | Todas as correções listadas abaixo |

### 3.2 Fix do CSV (Crítico)

**Linha 125 atual:**
```js
].join('\\n');
```
**Correção:**
```js
].join('\n');
```

Também adicionar BOM UTF-8 (`'﻿'`) no início do Blob para garantir que Excel abra corretamente caracteres acentuados:
```js
const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
```

### 3.3 Busca Reativa

> **Nota de código (validado em 2026-06-19):** `filteredTickets` (linha 86) NÃO é um `useMemo` — é um `.filter()` direto recalculado a cada render. A busca por texto usa `filtrosAplicados.busca` na **linha 90**. Como o array já recalcula a cada render, basta trocar a fonte do termo de busca para `filtros.busca` (estado atualizado em tempo real pelo input) — nenhum `useMemo` adicional é necessário.

Separar a responsabilidade:
- **Busca de texto** (`busca`): filtra em tempo real lendo `filtros.busca` diretamente.
- **Filtros estruturados** (status, prioridade, datas): continuam aplicados pelo botão "Aplicar Filtros" via `filtrosAplicados`.

Implementação: na linha 90, trocar `filtrosAplicados.busca` por `filtros.busca`. Para status/prioridade/datas, manter `filtrosAplicados`.

```js
// Linha 90 — antes:
const searchString = filtrosAplicados.busca.toLowerCase();
// depois (reativo):
const searchString = filtros.busca.toLowerCase();
```

> O termo de busca de texto deixa de ser limpo/aplicado pelo botão. Ajustar o `setFiltrosAplicados(filtros)` do botão "Aplicar" para preservar esse comportamento (continua copiando tudo, sem prejuízo).

### 3.4 Botão "Limpar Filtros"

Adicionar botão ao lado de "Aplicar Filtros" que reseta todos os estados:
```js
const clearFilters = () => {
  const empty = { status: 'Todos os status', prioridade: 'Todas as Prioridades', busca: '', dataInicio: '', dataFim: '' };
  setFiltros(empty);
  setFiltrosAplicados(empty);
};
```
Exibir o botão apenas quando algum filtro está ativo (exceto o padrão) para não poluir a UI.

### 3.5 Coluna de Resolução/Atualização

> **Validado em 2026-06-19:** O `ticketsToUpsert` em [glpi-service.ts:80-90](backend/src/services/glpi-service.ts) mapeia apenas `glpi_id, title, status, sla_status, priority, requester, category, created_at, company_id`. **O campo de modificação NÃO é salvo.** A API do GLPI fornece `t.date_mod` (já usado em `calculateSLA`, linha 168), então o dado existe na origem.

**⚠️ Risco de colisão:** a tabela `glpi_tickets` provavelmente já possui uma coluna `updated_at` gerenciada pelo banco (default `now()` / trigger). Gravar nosso próprio `updated_at` poderia conflitar com o timestamp do registro local. **Solução:** usar uma coluna dedicada `glpi_date_mod` (timestamptz) para a data de modificação vinda do GLPI, separada do `updated_at` do banco.

**Backend:**
1. Verificar se a coluna `glpi_date_mod` existe na tabela `glpi_tickets`. Se não, criar via migração:
   ```sql
   ALTER TABLE glpi_tickets ADD COLUMN IF NOT EXISTS glpi_date_mod timestamptz;
   ```
2. Adicionar ao `ticketsToUpsert`:
   ```js
   glpi_date_mod: t.date_mod ? new Date(t.date_mod).toISOString() : null,
   ```

**Frontend:**
- Adicionar coluna "Atualizado" na tabela, usando `ticket.glpi_date_mod`.
- Exibir `—` quando `glpi_date_mod` for nulo ou igual a `created_at`.

### 3.6 Indicador de Filtros Ativos

> **Nota:** já existe um contador "{filteredTickets.length} chamados encontrados" no cabeçalho da tabela (linha 307). Os chips abaixo são complementares — mostram QUAIS filtros estão ativos, não duplicam o contador.

Abaixo da barra de filtros, quando `filtrosAplicados` difere do estado padrão, exibir:
```
Filtros ativos: [Status: Em Andamento ×] [Prioridade: Alta ×]
```
Cada chip tem um `×` para remover aquele filtro específico (reseta para o valor padrão e reaplica).

---

## 4. Requisitos Funcionais

- **RF-001:** CSV exportado deve ter quebras de linha reais (`\n`) e BOM UTF-8.
- **RF-002:** Campo de busca por texto deve filtrar a tabela em tempo real sem clicar "Aplicar".
- **RF-003:** Botão "Limpar Filtros" deve aparecer quando há filtros ativos e resetar tudo.
- **RF-004:** Tabela deve exibir coluna de data de atualização/resolução.
- **RF-005:** Campo `updated_at` deve ser mapeado no sync GLPI se não estiver.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Baixar CSV e abrir no Excel mostra dados em linhas separadas com caracteres corretos.
- [ ] **CA-002:** Digitar no campo de busca filtra a tabela sem clicar em "Aplicar".
- [ ] **CA-003:** Botão "Limpar Filtros" aparece com filtros ativos e limpa tudo ao clicar.
- [ ] **CA-004:** Tabela mostra coluna de "Última atualização" com data formatada.
- [ ] **CA-005:** CSV inclui a coluna de data de atualização.

---

## 6. Dependências

### 6.1 Internas
- Independente de 003, 004 e 005.

### 6.2 Externas
- GLPI API deve retornar `date_mod` — verificar campo disponível no response da API.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `date_mod` não vem da API GLPI | Baixa | Baixo | Usar `date_mod` com fallback para `date_creation` |
| Busca reativa com muitos tickets pode ser lenta | Baixa | Baixo | `useMemo` é suficiente para listas de até 5000 items |
| BOM UTF-8 causar problema em Mac Numbers | Baixa | Baixo | Comportamento aceitável — Excel/LibreOffice funcionam corretamente |
