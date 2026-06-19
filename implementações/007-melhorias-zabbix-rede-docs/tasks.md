# Tarefas: Melhorias nos Módulos Zabbix, Rede e Documentação

> **Implementação:** 007
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 10/10 tarefas concluídas (100%)
> **Última atualização:** 2026-06-19

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Módulo Servidores (Zabbix)

- [x] **T-001:** Corrigir status "Atencao" → "Atenção" (com acento)
  - **Descrição:** Em `web/src/pages/paginasClient/Servidores/servidores.jsx`, localizar a função `displayStatus` (ou onde o status é renderizado no badge). Alterar o mapeamento para retornar `'Atenção'` quando o valor é `'Atencao'`. Também verificar se há `className` ou `style` condicional que usa a string `'Atencao'` — se sim, manter a comparação com `'Atencao'` (valor do banco) e só corrigir o texto exibido. Buscar por `Atencao` em todo o arquivo para garantir cobertura completa.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Servidores/servidores.jsx`
  - **Critério de conclusão:** Badge de status exibe "Atenção" com acento; nenhuma regressão no estilo condicional.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-002:** Adicionar seletor de servidor para mobile/tablet
  - **Descrição:** Em `servidores.jsx`, DENTRO da `ÁREA PRINCIPAL` (a partir da linha 161), logo após o `<header>` (linha 171), adicionar `<div className="block lg:hidden mb-6">` com um `<select>` com `value={effectiveActiveServerId || ''}` (não `activeServerId`, que é `null` até o clique) e `onChange={(e) => setActiveServerId(e.target.value)}`. Cada `<option>` mostra `{s.hostname} — {displayStatus(s.status)} | CPU: {s.cpu_usage}%`. Estilizar com `w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-slate-700`. A sidebar usa `hidden lg:flex` (linha 100), então o seletor cobre exatamente as telas onde ela some.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Servidores/servidores.jsx`
  - **Critério de conclusão:** Em viewport < 1024px, select de servidores visível e funcional; trocar a seleção atualiza os cards/gráfico.
  - **Dependências:** T-001 (usa `displayStatus` já corrigido)
  - **Estimativa:** Pequena

- [x] **T-003:** Corrigir formato do eixo X do gráfico de histórico
  - **Descrição:** Em `servidores.jsx`, na seção que processa `historyData` para o gráfico, encontrar a linha com `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })`. Substituir por `toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })`. Isso muda o label de "14:30" para "19/06 14:30", tornando o gráfico legível quando os dados abrangem múltiplos dias. Verificar se a largura do eixo X comporta labels maiores — se necessário, adicionar `angle: -30` ou `tick={{ fontSize: 10 }}` no componente `XAxis` do Recharts.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Servidores/servidores.jsx`
  - **Critério de conclusão:** Gráfico de histórico exibe "19/06 14:30" no eixo X; labels legíveis sem sobreposição.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-004:** Filtrar eventos recentes pelo servidor ativo
  - **Descrição:** Em `servidores.jsx`, na seção de "Eventos Recentes", encontrar o array `events` sendo renderizado. Adicionar filtro antes do render: `const displayedEvents = activeServer ? events.filter(e => e.entity_name === activeServer.hostname || e.entity_name === activeServer.name) : events;`. Usar `displayedEvents` no render em vez de `events`. Quando `displayedEvents.length === 0` após o filtro (e `activeServer` existe), exibir empty state: `<p className="text-sm text-slate-400 text-center py-6">Nenhum evento registrado para {activeServer.hostname}.</p>`.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Servidores/servidores.jsx`
  - **Critério de conclusão:** Selecionando servidor X, apenas eventos com `entity_name === X.hostname` aparecem; empty state exibido quando sem eventos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Módulo Rede

- [x] **T-005:** Adicionar campo de busca e filtro de status na tabela de rede
  - **Descrição:** Em `web/src/pages/paginasClient/Rede/rede.jsx`: (1) Adicionar estados `const [deviceSearch, setDeviceSearch] = useState('')` e `const [deviceStatusFilter, setDeviceStatusFilter] = useState('Todos')`. (2) Criar `filteredDevices` com `useMemo` que filtra `devices` por `deviceSearch` (verifica `device_name`, `ip_address` e `device_type` case-insensitive) e por `deviceStatusFilter` (`=== 'Todos'` ou `d.status === deviceStatusFilter`). (3) Adicionar painel de busca/filtro acima da tabela: input de texto com ícone de lupa e select com opções "Todos os Status", "Online", "Offline". (4) Usar `filteredDevices` no render da tabela em vez de `devices`. Importar `Search` de `lucide-react` se ainda não estiver importado.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Rede/rede.jsx`
  - **Critério de conclusão:** Digitar em busca filtra tabela em tempo real; select de status filtra por Online/Offline/Todos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-006:** Adicionar coluna Uptime% na tabela e card de uptime médio
  - **Descrição:** Em `rede.jsx`: (1) Adicionar `<th>` "Uptime" no `<thead>` da tabela de inventário. (2) No `<tbody>`, adicionar `<td>` com `{item.uptime_percent != null ? item.uptime_percent.toFixed(1) + '%' : '—'}`. Colorir com `text-green-600` para >= 99%, `text-yellow-600` para >= 90%, `text-red-600` para < 90%, e `text-slate-400` para `null`. (3) Nos cards de estatística no topo, adicionar card "Uptime Médio" exibindo `{stats?.avgUptime != null ? stats.avgUptime.toFixed(1) + '%' : '—'}` — posicionar como 4º card.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Rede/rede.jsx`
  - **Critério de conclusão:** Tabela tem coluna "Uptime" com cores; card de uptime médio visível no topo.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 3: Módulo Documentação

- [x] **T-007:** Substituir os `alert()` de download por mensagem inline
  - **Descrição:** Em `documentacao.jsx` há **dois** `alert()`: linha 46 (arquivo indisponível) e linha 54 (falha no download). (1) Adicionar estado `const [downloadError, setDownloadError] = useState('')`. (2) Substituir o `alert()` da linha 46 por `setDownloadError('Arquivo ainda não disponível para download.'); setTimeout(() => setDownloadError(''), 4000);` e retornar. (3) No `catch` (linha 52-55), substituir o `alert()` da linha 54 por `setDownloadError('Falha ao baixar o arquivo. Tente novamente.'); setTimeout(() => setDownloadError(''), 4000);`. (4) Renderizar inline acima da listagem: `{downloadError && <div className="mb-4 px-4 py-2.5 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-center gap-2"><AlertCircle size={16} />{downloadError}</div>}`. Importar `AlertCircle` de `lucide-react`.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Documentação/documentacao.jsx`
  - **Critério de conclusão:** Nenhum `alert()` nativo restante; ambos os erros exibem mensagem inline que some após 4s.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-008:** Corrigir contagens de categoria para refletir busca ativa
  - **Descrição:** Em `documentacao.jsx`, identificar onde os counts por categoria são calculados (provavelmente no render dos cards de categoria). Atualizar para usar `filteredDocuments` quando há busca ativa, e `documents` quando não há: `const countForCategory = (catName) => (searchTerm?.trim() ? filteredDocuments : documents).filter(doc => doc.category === catName).length;`. Se as categorias forem calculadas em um `useMemo`, adicionar `filteredDocuments` e `searchTerm` como dependências. Verificar o nome exato das variáveis no arquivo antes de editar.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Documentação/documentacao.jsx`
  - **Critério de conclusão:** Com busca ativa "contrato", o card "Contratos" mostra o número de contratos filtrados (não o total).
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 4: Empty States e Polish

- [x] **T-009:** Adicionar banner de "sem dados" no topo do MS365
  - **Descrição:** Validado: `microsoft.jsx` JÁ tem empty state na tabela (linha 457-465) e labels "Sem dados" nos cards. O que falta é um aviso claro no topo quando `metricsData.length === 0` — atualmente a página renderiza tenant info, cards zerados e donut vazio sem explicar o motivo. Adicionar, logo após o `<header>` (linha ~260), quando `!loading && metricsData.length === 0`: `<div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2"><AlertCircle size={16} /> Nenhuma licença sincronizada. Configure a integração Microsoft 365 em Empresas › Integrações ou aguarde a próxima sincronização.</div>`. Importar `AlertCircle`. Não remover o empty state existente da tabela.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Microsoft/microsoft.jsx`
  - **Critério de conclusão:** Com MS365 sem dados, banner âmbar explicativo aparece no topo; com dados, não aparece.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-010:** Adicionar empty state na tabela de rede quando filtros não retornam resultados
  - **Descrição:** Em `rede.jsx`, no `<tbody>` da tabela de inventário, quando `!loading && filteredDevices.length === 0`, renderizar: `<tr><td colSpan={N} className="px-5 py-10 text-center text-slate-400 text-sm">Nenhum dispositivo encontrado com os filtros aplicados. <button onClick={() => { setDeviceSearch(''); setDeviceStatusFilter('Todos'); }} className="text-blue-500 underline ml-1">Limpar filtros</button></td></tr>` onde `N` é o número de colunas. Quando `devices.length === 0` (sem dados), exibir mensagem diferente: "Nenhum equipamento de rede registrado."
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Rede/rede.jsx`
  - **Critério de conclusão:** Filtros sem resultado mostram mensagem com link para limpar; sem dados de rede exibe mensagem apropriada.
  - **Dependências:** T-005
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | displayStatus corrigido; className/style mantidos com 'Atencao' |
| T-002 | ✅ Concluída | 2026-06-19 | Select mobile com effectiveActiveServerId |
| T-003 | ✅ Concluída | 2026-06-19 | toLocaleString com dia/mês/hora/minuto; fontSize 10 |
| T-004 | ✅ Concluída | 2026-06-19 | Filtro por hostname/name; empty state personalizado |
| T-005 | ✅ Concluída | 2026-06-19 | deviceSearch + deviceStatusFilter + useMemo filteredDevices |
| T-006 | ✅ Concluída | 2026-06-19 | Coluna Uptime com cores + card Uptime Médio (5 cards) |
| T-007 | ✅ Concluída | 2026-06-19 | Ambos alert() removidos; erro inline com AlertCircle |
| T-008 | ✅ Concluída | 2026-06-19 | filteredDocuments movido antes de categoriesWithCounts |
| T-009 | ✅ Concluída | 2026-06-19 | Banner âmbar quando metricsData.length === 0 |
| T-010 | ✅ Concluída | 2026-06-19 | Empty state diferenciado: sem dados vs filtro vazio |
