# Tarefas: Correções e Melhorias nas Telas Admin

> **Implementação:** 008
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

### Fase 1: Empresas — Bug de Encoding (Crítico de Visibilidade)

- [x] **T-001:** Corrigir mojibake no modal de Integrações
  - **Descrição:** Em `empresasAdmin.jsx`: (1) Linha 407, trocar "Status das sincronizaÃ§Ãµes" por "Status das sincronizações". (2) Linha 417, trocar "Ãšltima sync:" por "Última sync:". (3) Fazer varredura no arquivo inteiro por outros caracteres mojibake (`Ã`, `Âµ`, `Âª`, `â€`) e corrigir todos. Garantir que o arquivo seja salvo em UTF-8 (não Latin-1/Windows-1252).
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`
  - **Critério de conclusão:** Modal de Integrações mostra textos acentuados corretamente; nenhum `Ã` residual no arquivo.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Empresas — Feedback e Validação

- [x] **T-002:** Verificar contrato de `addCompany`/`updateCompany` no CompanyContext
  - **Descrição:** Abrir `web/src/context/CompanyContext.jsx` e verificar se `addCompany` e `updateCompany` retornam Promise e/ou objeto de resultado (`{ success, error }`) ou se são fire-and-forget. Documentar o comportamento aqui nas observações da tarefa. Esse contrato define se T-003 pode usar `try/catch`/`await` para tratamento de erro real ou apenas validação client-side + toast de sucesso.
  - **Arquivos envolvidos:** `web/src/context/CompanyContext.jsx`
  - **Critério de conclusão:** Comportamento de retorno documentado; decisão sobre tratamento de erro definida.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações (2026-06-19):** Ambas as funções retornam `{ success: boolean, error?: string }` — elas capturam exceções internamente e NÃO lançam. T-003 implementado com verificação de `result.success === false` (sem try/catch no chamador).

- [x] **T-003:** Adicionar validação e feedback ao cadastro de empresa
  - **Descrição:** Em `empresasAdmin.jsx`: (1) Adicionar estado `const [formError, setFormError] = useState('')`. (2) No `handleSubmit`, validar `formValues.name.trim()` e `formValues.cnpj.trim()` — se vazios, `setFormError('Nome e CNPJ são obrigatórios.')` e `return` (sem fechar o modal). (3) Conforme resultado de T-002, envolver `addCompany`/`updateCompany` em `try/catch` (se retornarem Promise/erro) ou exibir confirmação de sucesso. (4) Renderizar `{formError && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{formError}</div>}` no topo do `<form>` do modal de cadastro (linha ~296). (5) Limpar `formError` em `handleOpenModal` e ao fechar.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`
  - **Critério de conclusão:** Salvar sem nome/CNPJ mostra erro e mantém o modal aberto; salvar válido fecha o modal.
  - **Dependências:** T-002
  - **Estimativa:** Média

### Fase 3: Inventário — Empty State, Feedback e Erros

- [x] **T-004:** Adicionar empty state na tabela de inventário
  - **Descrição:** Em `inventarioAdmin.jsx`, no `<tbody>` da tabela de ativos (após o `.map` de `visibleProfiles`), adicionar: quando `!loading && visibleProfiles.length === 0`, renderizar `<tr><td colSpan={8} className="p-10 text-center text-slate-400">Nenhum ativo encontrado com os filtros aplicados.</td></tr>`. A tabela tem 8 colunas (Ativo, Empresa, Origem, Tipo, Completude, Visibilidade, Saúde Geral, Ações).
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/inventarioAdmin/inventarioAdmin.jsx`
  - **Critério de conclusão:** Filtro sem resultados ou base vazia mostra a mensagem centralizada.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-005:** Adicionar feedback (toast) nas operações de inventário
  - **Descrição:** Em `inventarioAdmin.jsx`: (1) Adicionar `const [feedback, setFeedback] = useState(null)` e `const feedbackTimer = useRef(null)`, importar `useRef`. (2) Criar `showFeedback(type, text)` que limpa o timer anterior, faz `setFeedback({ type, text })` e agenda `setFeedback(null)` em 4000ms. (3) Envolver `saveProfile`, `markReviewed`, `toggleVisibility` e `toggleHealthScore` em `try/catch`: sucesso → `showFeedback('success', ...)`; erro → `showFeedback('error', ...)`. (4) Renderizar banner no topo: `{feedback && <div className={feedback.type === 'success' ? 'bg-emerald-50 text-emerald-700 ...' : 'bg-red-50 text-red-700 ...'}>{feedback.text}</div>}`. (5) Cleanup do timer no unmount.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/inventarioAdmin/inventarioAdmin.jsx`
  - **Critério de conclusão:** Salvar ficha, marcar revisão, alternar visibilidade e saúde exibem confirmação; erros exibem mensagem.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

- [x] **T-006:** Adicionar tratamento de erro no carregamento do inventário
  - **Descrição:** Em `inventarioAdmin.jsx`, na função `loadProfiles`, adicionar bloco `catch` entre o `try` e o `finally`: `catch (err) { showFeedback('error', 'Erro ao carregar inventário.'); setProfiles([]); }`. Isso evita que falhas de API deixem a tabela vazia sem explicação.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/inventarioAdmin/inventarioAdmin.jsx`
  - **Critério de conclusão:** Falha na chamada `/admin/inventory/profiles` exibe mensagem de erro (não tabela vazia silenciosa).
  - **Dependências:** T-005
  - **Estimativa:** Pequena

### Fase 4: Documentos Admin — Polimento (Opcional)

- [x] **T-007:** Substituir `alert()` por feedback inline em docAdmin
  - **Descrição:** Em `docAdmin.jsx`, substituir os 3 `alert()` (linhas 39, 92, 101) por feedback inline. Reaproveitar o estado `uploadProgress` (ou criar `actionMessage`) para exibir as mensagens na mesma área visual do progresso de upload, com auto-clear em 4-5s. Mensagens: linha 39 → "Selecione uma empresa específica para enviar documentos."; linha 92 → "Documento possui apenas registro lógico — arquivo não disponível."; linha 101 → "Falha ao gerar link de download."
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/docAdmin/docAdmin.jsx`
  - **Critério de conclusão:** Nenhum `alert()` nativo restante em docAdmin; mensagens exibidas inline.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena
  - **Observações:** Menor prioridade — pode ser adiado se houver restrição de tempo.

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | Mojibake corrigido; varredura completa sem resíduos |
| T-002 | ✅ Concluída | 2026-06-19 | addCompany/updateCompany retornam { success, error } |
| T-003 | ✅ Concluída | 2026-06-19 | formError state + validação + banner de erro no modal |
| T-004 | ✅ Concluída | 2026-06-19 | Empty state com colSpan=8 adicionado ao tbody |
| T-005 | ✅ Concluída | 2026-06-19 | feedback state + showFeedback + banner + cleanup |
| T-006 | ✅ Concluída | 2026-06-19 | catch em loadProfiles chama showFeedback('error') |
| T-007 | ✅ Concluída | 2026-06-19 | 3 alert() substituídos por actionMessage inline |
