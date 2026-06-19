# Tarefas: Gestão de Usuários e UX Admin

> **Implementação:** 005
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 9/9 tarefas concluídas (100%)
> **Última atualização:** 2026-06-19

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Backend — Email na Listagem

- [x] **T-001:** Incluir e-mail na resposta de GET /admin/users
  - **Descrição:** Em `backend/src/routes/admin/users-routes.ts`, na rota GET `/`, após buscar os profiles, chamar `supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })` para obter a lista de e-mails. Fazer merge por `id`: para cada profile, adicionar `email: authUsersMap[profile.id]?.email || ''`. Retornar o array enriquecido. Usar `Map` para O(1) no merge. Tratar erro da chamada auth sem quebrar o retorno principal (email fica vazio em caso de falha).
  - **Arquivos envolvidos:** `backend/src/routes/admin/users-routes.ts`
  - **Critério de conclusão:** GET `/admin/users` retorna objetos com campo `email` preenchido.
  - **Dependências:** Nenhuma
  - **Estimativa:** Média

### Fase 2: Gestão de Usuários — Frontend

- [x] **T-002:** Adicionar coluna E-mail na tabela de usuários
  - **Descrição:** Em `usuariosAdmin.jsx`, adicionar `<th>` "E-mail" no `<thead>` e `<td>` com `{user.email || '—'}` no `<tbody>`. Aplicar `truncate max-w-[180px]` com `title={user.email}` no `<td>` para e-mails longos. Posicionar a coluna após "Nome". Responsividade: ocultar em telas `sm` com `hidden md:table-cell`.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Tabela exibe e-mail; em telas < md a coluna fica oculta.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-003:** Estender busca para incluir e-mail
  - **Descrição:** Em `usuariosAdmin.jsx`, alterar o filtro `filteredUsers` para verificar também `user.email`. Troca: `(user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase())` → `((user.full_name || '') + ' ' + (user.email || '')).toLowerCase().includes(searchTerm.toLowerCase())`. Atualizar placeholder do input de busca para "Buscar por nome ou e-mail...".
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Buscar pelo e-mail de um usuário retorna o usuário; placeholder atualizado.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-004:** Exibir e-mail atual no modal de edição
  - **Descrição:** No modal de edição (`isModalOpen && editingUser`), adicionar logo abaixo do título uma linha read-only com o e-mail do usuário sendo editado: `<p className="text-xs text-slate-500 -mt-2 mb-2">✉ {editingUser.email}</p>`. Não é um campo de input — é apenas informativo para confirmar qual usuário está sendo editado.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Modal de edição exibe e-mail do usuário como texto read-only no topo.
  - **Dependências:** T-001
  - **Estimativa:** Pequena

- [x] **T-005:** Adicionar campo de confirmação no modal de reset de senha
  - **Descrição:** No modal de reset (`resetUser`), adicionar segundo `Field` com label "Confirmar nova senha" e estado `confirmNewPassword`. No `handleResetPassword`: validar que `newPassword === confirmNewPassword` (senão exibir erro no modal) e que `newPassword.length >= 8` (senão exibir "Mínimo 8 caracteres"). Adicionar hint abaixo dos campos: `<p className="text-xs text-slate-400">Mínimo de 8 caracteres</p>`. Limpar `confirmNewPassword` junto com `newPassword` ao fechar o modal.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Modal de reset tem 2 campos; validações impedem envio com senha < 8 chars ou campos divergentes.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-006:** Implementar auto-clear de mensagens de feedback
  - **Descrição:** Em `usuariosAdmin.jsx`, adicionar `feedbackTimerRef = useRef(null)`. Criar função `showFeedback(type, text)` que: (1) limpa timer anterior com `clearTimeout`, (2) chama `setFeedback({ type, text })`, (3) agenda `clearTimeout` de 5000ms para `setFeedback(null)`. Substituir todas as chamadas `setFeedback(...)` pelo novo `showFeedback(...)`. Garantir limpeza do timer no cleanup do componente (`useEffect(() => () => clearTimeout(feedbackTimerRef.current), [])`).
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Mensagens de sucesso e erro desaparecem automaticamente após 5 segundos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-007:** Adicionar empty state e contador de resultados na tabela
  - **Descrição:** (1) No `<tbody>`, quando `!loading && filteredUsers.length === 0`, renderizar `<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">Nenhum usuário encontrado com os filtros aplicados.</td></tr>`. (2) No cabeçalho da seção (acima da tabela ou abaixo dos filtros), adicionar `<p className="text-xs text-slate-500">{filteredUsers.length} usuário(s) encontrado(s)</p>`.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx`
  - **Critério de conclusão:** Filtros sem resultado mostram mensagem; contador reflete filtros ativos.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 3: Dashboard Admin e Configurações

- [x] **T-008:** Tornar cards do dashboard admin clicáveis
  - **Descrição:** Em `dashAdmin.jsx`, importar `useNavigate` de `react-router-dom`. Adicionar propriedade `path` em cada objeto do array `cards`: Empresas → `/admin/empresasAdmin`, Usuários → `/admin/usuariosAdmin`, Documentos → `/admin/docAdmin`, Saúde Operacional → `/admin/auditAdmin`. Nos cards renderizados, adicionar `onClick={() => navigate(card.path)}` e as classes `cursor-pointer hover:shadow-md hover:border-blue-200 transition-all` no container do card.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/dashAdmin/dashAdmin.jsx`
  - **Critério de conclusão:** Clicar em cada card navega para a seção correspondente.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-009:** Adicionar validação ao campo de timeout em configAdmin
  - **Descrição:** Em `configAdmin.jsx`: (1) Adicionar `max={480}` e `min={5}` no input de timeout. (2) No `handleSave`, antes de enviar, validar: se `sessionTimeout < 5`, exibir `setErrorMessage('O timeout mínimo é 5 minutos.')` e retornar; se `sessionTimeout > 480`, exibir `setErrorMessage('O timeout máximo é 480 minutos (8 horas).')` e retornar; se `systemName.trim() === ''`, exibir `setErrorMessage('O nome do sistema não pode ficar em branco.')` e retornar. Garantir que o valor de timeout seja parseado como número inteiro antes da validação.
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/configAdmin/configAdmin.jsx`
  - **Critério de conclusão:** Salvar com timeout inválido ou nome vazio exibe erro sem chamar o backend.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | Backend — pré-requisito para T-002, T-003, T-004 |
| T-002 | ✅ Concluída | 2026-06-19 | Depende de T-001 |
| T-003 | ✅ Concluída | 2026-06-19 | Depende de T-001 |
| T-004 | ✅ Concluída | 2026-06-19 | Depende de T-001 |
| T-005 | ✅ Concluída | 2026-06-19 | Independente |
| T-006 | ✅ Concluída | 2026-06-19 | Independente |
| T-007 | ✅ Concluída | 2026-06-19 | Independente |
| T-008 | ✅ Concluída | 2026-06-19 | Independente |
| T-009 | ✅ Concluída | 2026-06-19 | Independente |
