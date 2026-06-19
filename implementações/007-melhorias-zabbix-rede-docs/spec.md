# Especificação: Melhorias nos Módulos Zabbix, Rede e Documentação

> **ID:** 007
> **Status:** 🟡 Planejada
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Conjunto de melhorias nos módulos de Servidores (Zabbix), Rede e Documentação: correção do seletor de servidores no mobile, melhoria no gráfico de histórico temporal, busca/filtro na tabela de rede, exibição de uptime de rede, correção de status "Atencao" → "Atenção", erro de download inline em documentação, e correção das contagens de categoria que não refletem a busca ativa.

---

## 2. Contexto e Motivação

### 2.1 Servidores (Zabbix)

**Mobile — sidebar invisível:**
- O painel lateral com lista de servidores usa `hidden lg:flex`, sumindo em tablets e celulares.
- Em mobile, o usuário vê o dashboard do primeiro servidor mas não consegue navegar para outros.
- Não há fallback mobile (dropdown, select, etc.).

**Gráfico de histórico — eixo X só com hora:min:**
- `toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })` formata como "14:30".
- Se o histórico acumula dados de vários dias (até 100 pontos), todos os labels colapsam em "HH:MM" sem indicar o dia — o eixo X fica ilegível e repetitivo.
- Deve mostrar "DD/MM HH:mm" ou pelo menos "DD HH:mm".

**Status "Atencao" sem acento:**
- O Zabbix service grava `status: 'Atencao'` (sem acento) e a UI exibe "Atencao" no badge.
- O texto correto em português é "Atenção". O mapeamento de exibição deve corrigir isso.

**Eventos não filtrados pelo servidor ativo:**
- A seção "Eventos Recentes" carrega todos os eventos de servidor da empresa via `/client/metrics/servers/events`.
- Mesmo com um servidor selecionado, todos os eventos aparecem, causando confusão.
- Deve filtrar pelo `entity_name` que corresponde ao `hostname` do servidor ativo.

### 2.2 Rede

**Sem busca na tabela:**
- Com dezenas ou centenas de equipamentos de rede (switches, firewalls, APs), não há campo de busca.
- O usuário precisa fazer scroll manual para encontrar um equipamento específico.

**Uptime não exibido:**
- O backend `/client/network/stats` retorna `avgUptime` e cada dispositivo tem `uptime_percent`, mas a UI não mostra nenhum desses dados em lugar algum.
- Seria valioso ver uptime de cada dispositivo na tabela.

**Sem filtro por status (online/offline):**
- Não há como ver só os dispositivos offline para triagem rápida.

### 2.3 Documentação

**Erro de download usa `alert()`:**
- `documentacao.jsx:52`: `alert('Arquivo não disponível para download.')` é um alerta nativo do browser — fora do padrão visual do portal.
- Deve ser substituído por um estado de feedback inline (toast ou mensagem na página).

**Contagens de categoria não refletem busca ativa:**
- Os cards de categoria exibem `documents.filter(doc => doc.category === catName).length` calculado sobre `documents` (total), não sobre os documentos filtrados pela busca.
- Se o usuário busca "contrato financeiro" e vê 3 resultados, o card "Contratos" ainda mostra "15 arquivos" (total), criando inconsistência.

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `web/src/pages/paginasClient/Servidores/servidores.jsx` | Modificar | Mobile selector, histórico, status, eventos filtrados |
| `web/src/pages/paginasClient/Rede/rede.jsx` | Modificar | Busca, uptime, filtro online/offline |
| `web/src/pages/paginasClient/Documentação/documentacao.jsx` | Modificar | Download error inline, contagens de categoria reflexivas |

### 3.2 Servidores — Seletor Mobile

> **Validado:** `servidores.jsx` deriva `effectiveActiveServerId = activeServerId || servers[0]?.id` (linha 33) e tem `setActiveServerId` (linha 29). O `<select>` deve ler `effectiveActiveServerId` (não `activeServerId`, que é `null` até o usuário clicar). A sidebar usa `hidden lg:flex` (linha 100), então o seletor mobile deve ir DENTRO da `ÁREA PRINCIPAL` (linha 161), logo após o `<header>` (linha 171), com `block lg:hidden`.

```jsx
<div className="block lg:hidden mb-6">
  <select
    value={effectiveActiveServerId || ''}
    onChange={(e) => setActiveServerId(e.target.value)}
    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm text-slate-700"
  >
    {servers.map((s) => (
      <option key={s.id} value={s.id}>
        {s.hostname} — {displayStatus(s.status)} | CPU: {s.cpu_usage}%
      </option>
    ))}
  </select>
</div>
```

### 3.3 Servidores — Gráfico Histórico com Data

Alterar o mapeamento do eixo X de:
```js
time: new Date(row.collected_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
```
para:
```js
time: new Date(row.collected_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
```
Resultado: "19/06 14:30" — legível e sem ambiguidade de dia.

### 3.4 Servidores — Status "Atenção"

Em `servidores.jsx`, na função `displayStatus`:
```js
const displayStatus = (status) => {
  if (status === 'Atencao') return 'Atenção';
  return status;
};
```
A função já existe (`status === 'Atencao' ? 'Atencao' : status`), só precisa corrigir o retorno.

### 3.5 Servidores — Eventos Filtrados pelo Servidor Ativo

O endpoint `/client/metrics/servers/events` retorna eventos com campo `entity_name` = hostname do servidor.
Filtrar no frontend:
```js
const displayedEvents = activeServer
  ? events.filter(e => e.entity_name === activeServer.hostname)
  : events;
```
Se `displayedEvents.length === 0` após filtro, exibir: "Nenhum evento registrado para este servidor."

### 3.6 Rede — Busca + Filtro de Status

Adicionar acima da tabela de inventário:
```jsx
<div className="p-5 flex flex-col sm:flex-row gap-3">
  <div className="relative flex-1">
    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
    <input
      type="text"
      placeholder="Buscar por nome, IP ou tipo..."
      value={deviceSearch}
      onChange={(e) => setDeviceSearch(e.target.value)}
      className="w-full pl-9 pr-3 py-2 ..."
    />
  </div>
  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="...">
    <option value="Todos">Todos os Status</option>
    <option value="Online">Online</option>
    <option value="Offline">Offline</option>
  </select>
</div>
```
Filtro aplicado via `useMemo`:
```js
const filteredDevices = useMemo(() =>
  devices.filter(d => {
    const matchSearch = [d.device_name, d.ip_address, d.device_type]
      .some(v => (v || '').toLowerCase().includes(deviceSearch.toLowerCase()));
    const matchStatus = statusFilter === 'Todos' || d.status === statusFilter;
    return matchSearch && matchStatus;
  }),
  [devices, deviceSearch, statusFilter]
);
```

### 3.7 Rede — Coluna Uptime + Card de Uptime Médio

Adicionar coluna "Uptime" na tabela com `{item.uptime_percent != null ? item.uptime_percent + '%' : '—'}`.
No card "Tipos", substituir ou adicionar card "Uptime Médio" mostrando `stats?.avgUptime + '%'`.

### 3.8 Documentação — Download Error Inline

> **Validado:** `documentacao.jsx` tem **dois** `alert()` — linha 46 (arquivo indisponível) e linha 54 (falha no download). Ambos devem virar feedback inline.

Substituir os `alert()` por estado de erro inline:
```js
const [downloadError, setDownloadError] = useState('');

const handleDownload = async (doc) => {
  if (!doc.file_url || doc.file_url === 'storage_pendente') {
    setDownloadError('Arquivo ainda não disponível para download.');
    setTimeout(() => setDownloadError(''), 4000);
    return;
  }
  try {
    const res = await api.get(`/client/docs/${doc.id}/download`, requestConfig);
    window.open(res.data.url, '_blank');
  } catch (error) {
    setDownloadError('Falha ao baixar o arquivo. Tente novamente.');
    setTimeout(() => setDownloadError(''), 4000);
  }
};
```
Renderizar `{downloadError && <div className="...text-red-600...">{downloadError}</div>}` acima da listagem.

### 3.9 Documentação — Contagens de Categoria Reflexivas

Atualizar cálculo para usar `filteredDocuments` em vez de `documents`:
```js
// Antes: documents.filter(doc => doc.category === catName).length
// Depois:
const categoriesWithCounts = useMemo(() => categoriesList.map(catName => ({
  name: catName,
  count: (searchTerm ? filteredDocuments : documents).filter(doc => doc.category === catName).length
})), [documents, filteredDocuments, searchTerm, categoriesList]);
```
Quando há busca ativa, os counts refletem os documentos filtrados. Sem busca, mostram o total.

---

## 4. Requisitos Funcionais

- **RF-001:** Em mobile/tablet, deve existir select de servidor acima do dashboard.
- **RF-002:** Gráfico de histórico exibe "DD/MM HH:mm" no eixo X.
- **RF-003:** Badge de status exibe "Atenção" com acento correto.
- **RF-004:** Seção de eventos filtra pelo hostname do servidor ativo.
- **RF-005:** Tabela de rede tem campo de busca por nome, IP e tipo.
- **RF-006:** Tabela de rede tem filtro de status (Online/Offline/Todos).
- **RF-007:** Tabela de rede exibe coluna de uptime%.
- **RF-008:** Erro de download em documentação exibe mensagem inline, sem `alert()`.
- **RF-009:** Contagens nos cards de categoria refletem os documentos filtrados pela busca.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Em viewport mobile (<1024px), select de servidores visível e funcional.
- [ ] **CA-002:** Gráfico de histórico mostra "19/06 14:30" no eixo X.
- [ ] **CA-003:** Badge de status mostra "Atenção" (com acento).
- [ ] **CA-004:** Selecionando "SERVIDOR-A", a seção de eventos só mostra eventos desse servidor.
- [ ] **CA-005:** Digitar "192.168" na busca de rede filtra os dispositivos com esse IP.
- [ ] **CA-006:** Selecionar "Offline" no filtro mostra só dispositivos offline.
- [ ] **CA-007:** Coluna "Uptime" presente na tabela de rede.
- [ ] **CA-008:** Clicar em documento sem arquivo exibe mensagem inline (sem alert nativo).
- [ ] **CA-009:** Com busca ativa em documentação, cards de categoria mostram contagem dos documentos filtrados.

---

## 6. Dependências

### 6.1 Internas
- Independente das demais implementações.

### 6.2 Externas
- Dados de `uptime_percent` nos dispositivos de rede devem vir preenchidos pelo Zabbix sync (verificar se o campo existe na tabela `network_devices`).

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `uptime_percent` não populado na tabela `network_devices` | Média | Baixo | Exibir `—` quando nulo; não quebra a UI |
| Select mobile com muitos servidores (>20) fica longo | Baixa | Baixo | Limitar a 50 itens — edge case raro |
| `filteredDocuments` no useMemo de categorias causar recalculo frequente | Baixa | Baixo | Dependência de `searchTerm` já existe; useMemo evita recalculo desnecessário |
