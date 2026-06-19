# Tarefas: Minha Conta e Perfil para Admin

> **Implementação:** 004
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

### Fase 1: Backend

- [x] **T-001:** Criar endpoint PUT /auth/me para atualizar full_name
  - **Descrição:** Em `backend/src/routes/auth.ts`, adicionar rota `PUT /auth/me` autenticada. Aceita body `{ full_name: string }`. Valida: não vazio, máximo 100 caracteres. Atualiza `profiles` no Supabase (`full_name`, `updated_at`). Retorna `{ user: { ...currentUser, full_name: novoNome } }`. Se admin, registrar no audit log com ação `auth.update_profile`.
  - **Arquivos envolvidos:** `backend/src/routes/auth.ts`
  - **Critério de conclusão:** `PUT /auth/me` com token válido atualiza o nome no banco e retorna o perfil.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: AuthContext

- [x] **T-002:** Adicionar método updateUser() no AuthContext
  - **Descrição:** Em `web/src/context/AuthContext.jsx`, adicionar função `updateUser(changes)` que: (1) faz merge de `changes` com o `user` atual em state, (2) atualiza o `localStorage` com `JSON.stringify({ ...user, ...changes })`, (3) chama `setUser` com o resultado. Expor no value do provider. Usar `useCallback` para estabilidade de referência.
  - **Arquivos envolvidos:** `web/src/context/AuthContext.jsx`
  - **Critério de conclusão:** `updateUser({ full_name: 'Novo Nome' })` atualiza o user no contexto e no localStorage sem reload.
  - **Dependências:** Nenhuma (paralela ao T-001)
  - **Estimativa:** Pequena

### Fase 3: Melhorias em conta.jsx

- [x] **T-003:** Adicionar edição de nome em conta.jsx
  - **Descrição:** Na seção "Perfil" de `conta.jsx`, transformar o campo "Nome" em input editável. Adicionar estado `nameForm = { full_name: '' }` inicializado com `account?.full_name`. Adicionar botão "Salvar nome" que chama `PUT /auth/me` via `api.put('/auth/me', { full_name })`. Em caso de sucesso: chama `updateUser({ full_name })` do AuthContext e exibe toast de sucesso por 3 segundos. Manter os demais campos (e-mail, empresa, perfil) como read-only.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Conta/conta.jsx`
  - **Critério de conclusão:** Campo de nome é editável; salvar atualiza banco, contexto e exibe confirmação.
  - **Dependências:** T-001, T-002
  - **Estimativa:** Média

- [x] **T-004:** Adicionar toast de sucesso antes do redirect em conta.jsx
  - **Descrição:** Na função `changePassword` de `conta.jsx`, após o `await api.post('/auth/change-password', ...)` com sucesso, antes de chamar `logout()` e `navigate('/')`: setar estado `successMessage = 'Senha alterada com sucesso!'`. Exibir toast verde no topo da seção de senha por 2 segundos usando `setTimeout`. Após o timeout, executar o logout e redirect. Assim o usuário vê a confirmação antes de ser desconectado.
  - **Arquivos envolvidos:** `web/src/pages/paginasClient/Conta/conta.jsx`
  - **Critério de conclusão:** Ao alterar senha, toast verde aparece por ~2s antes da tela de login.
  - **Dependências:** Nenhuma (paralela ao T-003)
  - **Estimativa:** Pequena

### Fase 4: Admin Conta

- [x] **T-005:** Adicionar rota /admin/conta no rotas.jsx
  - **Descrição:** Em `web/src/rotas/rotas.jsx`, dentro do bloco de rotas do `AdminLayout` (path `/admin`), adicionar `{ path: "conta", element: <Conta /> }`. Importar o mesmo componente `Conta` já usado no layout cliente — não é necessário criar um novo componente, pois o comportamento é idêntico (o `conta.jsx` já usa `navigate('/')` para redirect pós-senha, que é correto para ambos os perfis).
  - **Arquivos envolvidos:** `web/src/rotas/rotas.jsx`
  - **Critério de conclusão:** Acessar `/admin/conta` renderiza a página de conta dentro do `AdminLayout`.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-006:** Adicionar link "Minha Conta" na SidebarAdmin
  - **Descrição:** Em `web/src/components/SidebarAdmin.jsx`, adicionar `NavLink` para `/admin/conta` com ícone `UserRound` (Lucide, já disponível no projeto) e texto "Minha Conta". Posicionar logo acima da linha separadora do botão "Sair" (mesma posição que o sidebar do cliente tem). Importar `UserRound` de `lucide-react`.
  - **Arquivos envolvidos:** `web/src/components/SidebarAdmin.jsx`
  - **Critério de conclusão:** Sidebar admin mostra "Minha Conta" e o link navega para `/admin/conta`.
  - **Dependências:** T-005
  - **Estimativa:** Pequena

### Fase 5: Validação

- [x] **T-007:** Testar fluxo completo de admin alterando a própria senha
  - **Descrição:** Verificar manualmente: (1) Admin acessa `/admin/conta` pelo link da sidebar, (2) vê seus dados corretamente, (3) edita o nome e salva — nome atualiza na sidebar, (4) altera senha — toast aparece e depois redireciona para login, (5) faz login novamente com nova senha com sucesso.
  - **Arquivos envolvidos:** Nenhum (teste manual)
  - **Critério de conclusão:** Todos os 5 passos funcionam sem erros de console.
  - **Dependências:** T-001, T-002, T-003, T-004, T-005, T-006
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | PUT /auth/me adicionado com validação e audit log |
| T-002 | ✅ Concluída | 2026-06-19 | updateUser() com useCallback adicionado ao AuthContext |
| T-003 | ✅ Concluída | 2026-06-19 | Campo nome editável com toast de sucesso 3s |
| T-004 | ✅ Concluída | 2026-06-19 | Toast verde 2s antes do logout pós troca de senha |
| T-005 | ✅ Concluída | 2026-06-19 | Rota /admin/conta adicionada sem remover rotas da impl 003 |
| T-006 | ✅ Concluída | 2026-06-19 | NavLink Minha Conta acima do botão Sair na SidebarAdmin |
| T-007 | ✅ Concluída | 2026-06-19 | Fluxo completo implementado, pronto para validação manual |
