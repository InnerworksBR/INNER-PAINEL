# Especificação: Correções e Melhorias nas Telas Admin (Empresas, Inventário, Documentos)

> **ID:** 008
> **Status:** 🟡 Planejada
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Correção de bugs e lacunas nas telas administrativas que não foram cobertas pelas implementações anteriores (que focaram no portal do cliente e gestão de usuários). Inclui um bug de **encoding (mojibake)** visível na tela de Empresas, ausência de feedback ao salvar/cadastrar empresa, e falta de empty states e tratamento de erro na tela de Inventário.

---

## 2. Contexto e Motivação

### 2.1 Empresas (`empresasAdmin.jsx`)

**Bug de encoding (mojibake) — visível ao usuário:**
- Linha 407: `<h3>Status das sincronizaÃ§Ãµes</h3>` — deveria ser "Status das sincronizações".
- Linha 417: `Ãšltima sync:` — deveria ser "Última sync:".
- São caracteres UTF-8 corrompidos (lidos como Latin-1) que aparecem literalmente na interface do modal de Integrações.

**Cadastro/edição de empresa sem feedback:**
- `handleSubmit` (linha 111-121) chama `addCompany`/`updateCompany` e fecha o modal, mas **não exibe nenhuma confirmação de sucesso nem trata erro**.
- Se `name` ou `cnpj` estiverem vazios, o `if` silenciosamente não faz nada — o usuário clica "Confirmar" e nada acontece, sem mensagem.
- Diferente do modal de Integrações (que tem `saveError`/`saveSuccess` banners), o modal de cadastro não tem retorno visual.

**Exclusão via `window.confirm`:**
- `handleDeleteClick` (linha 124) usa `window.confirm` nativo. Aceitável para ação destrutiva, mas inconsistente com o restante do portal (que usa modais). *Item de baixa prioridade.*

### 2.2 Inventário (`inventarioAdmin.jsx`)

**Sem empty state na tabela:**
- Quando `visibleProfiles` está vazio (sem ativos ou filtro sem resultado), a tabela renderiza apenas o cabeçalho, sem nenhuma mensagem.

**Operações sem feedback:**
- `saveProfile`, `markReviewed`, `toggleVisibility`, `toggleHealthScore` executam chamadas à API mas **não dão retorno visual** de sucesso/erro — o usuário não sabe se salvou.

**Erros silenciados:**
- `loadProfiles` tem `try/finally` mas **sem `catch`** — se a API falhar, o erro é engolido e a tabela fica vazia sem explicação.
- `openProfile` e `saveProfile` não têm tratamento de erro.

### 2.3 Documentos Admin (`docAdmin.jsx`)

**Uso de `alert()` em 3 pontos:**
- Linha 39 (selecione empresa), linha 92 (arquivo indisponível), linha 101 (falha no download).
- O upload já usa feedback inline (`uploadProgress`); os alerts são inconsistentes com esse padrão. *Item de polimento.*

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx` | Modificar | Fix encoding, feedback no cadastro, validação |
| `web/src/pages/paginasAdmin/inventarioAdmin/inventarioAdmin.jsx` | Modificar | Empty state, feedback, tratamento de erro |
| `web/src/pages/paginasAdmin/docAdmin/docAdmin.jsx` | Modificar | Substituir `alert()` por feedback inline |

### 3.2 Empresas — Corrigir Encoding (Mojibake)

Substituir os caracteres corrompidos pelos corretos:
```jsx
// Linha 407 — antes:
<h3 className="font-semibold text-slate-800 mb-3">Status das sincronizaÃ§Ãµes</h3>
// depois:
<h3 className="font-semibold text-slate-800 mb-3">Status das sincronizações</h3>

// Linha 417 — antes:
<p className="text-xs text-slate-500 mt-2">Ãšltima sync: {formatSyncDate(item.lastSync)}</p>
// depois:
<p className="text-xs text-slate-500 mt-2">Última sync: {formatSyncDate(item.lastSync)}</p>
```
> **Atenção:** salvar o arquivo em UTF-8. Fazer uma varredura no arquivo por outros caracteres `Ã`, `Âµ`, `Âª` para garantir que não há mais mojibake escondido.

### 3.3 Empresas — Feedback e Validação no Cadastro

Reaproveitar o padrão de banner já existente no modal de Integrações (`saveError`/`saveSuccess`). Adicionar estados e validação ao modal de cadastro:
```js
const [formError, setFormError] = useState('');

const handleSubmit = async (e) => {
  e.preventDefault();
  setFormError('');
  if (!formValues.name.trim() || !formValues.cnpj.trim()) {
    setFormError('Nome e CNPJ são obrigatórios.');
    return;
  }
  try {
    if (editingCompany) {
      await updateCompany({ ...formValues, id: editingCompany.id });
    } else {
      await addCompany(formValues);
    }
    setIsModalOpen(false);
  } catch (err) {
    setFormError(err.message || 'Erro ao salvar empresa.');
  }
};
```
- Renderizar `{formError && <div className="...bg-red-50 text-red-700...">{formError}</div>}` no topo do `<form>` do modal de cadastro.
- Limpar `formError` ao abrir/fechar o modal.
- Verificar se `addCompany`/`updateCompany` no `CompanyContext` retornam Promise/erro — se forem síncronos sem retorno de erro, exibir apenas o sucesso (toast) e manter validação client-side.

### 3.4 Inventário — Empty State

No `<tbody>` da tabela de ativos, quando `!loading && visibleProfiles.length === 0`:
```jsx
{!loading && visibleProfiles.length === 0 && (
  <tr>
    <td colSpan={8} className="p-10 text-center text-slate-400">
      Nenhum ativo encontrado com os filtros aplicados.
    </td>
  </tr>
)}
```

### 3.5 Inventário — Feedback nas Operações

Adicionar um estado de feedback simples (toast/banner) reaproveitável:
```js
const [feedback, setFeedback] = useState(null); // { type: 'success'|'error', text }
const feedbackTimer = useRef(null);

const showFeedback = (type, text) => {
  clearTimeout(feedbackTimer.current);
  setFeedback({ type, text });
  feedbackTimer.current = setTimeout(() => setFeedback(null), 4000);
};
```
- `saveProfile`: em sucesso → `showFeedback('success', 'Ficha salva.')`; em erro (try/catch) → `showFeedback('error', 'Falha ao salvar.')`.
- `markReviewed`, `toggleVisibility`, `toggleHealthScore`: mesma abordagem.
- Renderizar o banner no topo da página (acima do `<header>` ou logo abaixo).

### 3.6 Inventário — Tratamento de Erro no Load

```js
const loadProfiles = async () => {
  setLoading(true);
  try {
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
    const response = await api.get('/admin/inventory/profiles', { params });
    setProfiles(response.data || []);
  } catch (err) {
    showFeedback('error', 'Erro ao carregar inventário.');
    setProfiles([]);
  } finally {
    setLoading(false);
  }
};
```

### 3.7 Documentos Admin — Substituir `alert()` (Polimento)

Reaproveitar o `uploadProgress` existente (ou um novo estado `actionMessage`) para exibir as 3 mensagens inline em vez de `alert()`:
- Linha 39: "Selecione uma empresa específica para enviar documentos."
- Linha 92: "Documento possui apenas registro lógico — arquivo não disponível."
- Linha 101: "Falha ao gerar link de download."

> Item de menor prioridade — pode ser executado por último ou adiado se houver restrição de tempo.

---

## 4. Requisitos Funcionais

- **RF-001:** Modal de Integrações exibe "Status das sincronizações" e "Última sync" sem mojibake.
- **RF-002:** Cadastro/edição de empresa exibe erro de validação quando nome ou CNPJ vazios.
- **RF-003:** Cadastro/edição de empresa trata e exibe erro de salvamento.
- **RF-004:** Tabela de inventário exibe mensagem quando não há ativos.
- **RF-005:** Operações de inventário (salvar, revisar, visibilidade, saúde) dão feedback visual.
- **RF-006:** Falha ao carregar inventário exibe mensagem em vez de tabela vazia silenciosa.
- **RF-007:** (Polimento) `docAdmin` substitui `alert()` por feedback inline.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Abrir modal de Integrações de uma empresa mostra os textos corretamente acentuados.
- [ ] **CA-002:** Tentar salvar empresa sem nome/CNPJ mostra erro inline e não fecha o modal.
- [ ] **CA-003:** Salvar empresa com sucesso fecha o modal (ou mostra confirmação).
- [ ] **CA-004:** Filtrar inventário sem resultados mostra "Nenhum ativo encontrado".
- [ ] **CA-005:** Salvar uma ficha de ativo exibe confirmação de sucesso.
- [ ] **CA-006:** Simular falha de API no inventário exibe mensagem de erro.
- [ ] **CA-007:** Varredura do `empresasAdmin.jsx` não encontra mais caracteres mojibake.

---

## 6. Dependências

### 6.1 Internas
- Independente das implementações 003–007.
- Reaproveita o padrão de `showFeedback` com `useRef` (mesma técnica de 005 T-006).

### 6.2 Externas
- Comportamento de `addCompany`/`updateCompany`/`updateCompany` no `CompanyContext` deve ser verificado (retorno de erro/Promise) antes de implementar o tratamento.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `addCompany`/`updateCompany` não retornam erro (fire-and-forget) | Média | Médio | Verificar `CompanyContext`; se síncronos, manter só validação client-side + toast de sucesso |
| Editor salvar arquivo em encoding errado e reintroduzir mojibake | Baixa | Alto | Garantir UTF-8 ao salvar; varredura final por `Ã` no arquivo |
| Novos toasts poluírem a UI admin | Baixa | Baixo | Auto-clear em 4s com `useRef` (sem acúmulo) |
