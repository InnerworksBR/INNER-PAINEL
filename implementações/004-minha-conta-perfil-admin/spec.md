# Especificação: Minha Conta e Perfil para Admin

> **ID:** 004
> **Status:** 🟡 Planejada
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Adicionar a funcionalidade "Minha Conta" no painel admin (atualmente inexistente) e melhorar a página de conta do cliente com edição de nome e feedback de sucesso mais claro. Atualmente, admins não conseguem alterar sua própria senha pelo portal — precisam de outro admin ou acesso direto ao Supabase.

---

## 2. Contexto e Motivação

### 2.1 Problema Atual

- Usuários com role `admin` não têm rota `/admin/conta` nem link "Minha Conta" na `SidebarAdmin`.
- A única forma de um admin alterar sua própria senha é através da tela de Gestão de Usuários, que exige que outro admin o procure e faça um reset manual — ou que o próprio admin se encontre na lista e use o botão de reset (o que é confuso).
- Na página `conta.jsx` do cliente, após alterar a senha a página faz logout e redireciona imediatamente sem nenhum feedback visual de sucesso antes da transição.
- Usuários não conseguem editar seu próprio nome de exibição (`full_name`) pela interface.

### 2.2 Impacto do Problema

- Admins são bloqueados do próprio sistema se esquecem a senha (dependem de outro admin ou Supabase diretamente).
- UX quebrada no fluxo de alteração de senha: o usuário não vê confirmação antes de ser desconectado.

### 2.3 Solução Adotada

- Criar rota `/admin/conta` no `AdminLayout` e adicionar link na `SidebarAdmin`.
- O componente de conta admin reutiliza a lógica de `conta.jsx` do cliente, mas com navegação adaptada para admins.
- Criar endpoint `PUT /auth/me` no backend para atualizar `full_name`.
- Adicionar estado transitório de sucesso em `conta.jsx` antes de redirecionar para o login.
- Adicionar `updateUser()` no `AuthContext` para atualizar o usuário em memória após edição de nome.

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `backend/src/routes/auth.ts` | Modificar | Adicionar `PUT /auth/me` para atualizar `full_name` do usuário autenticado |
| `web/src/context/AuthContext.jsx` | Modificar | Adicionar método `updateUser(changes)` para atualizar dados do usuário em contexto e localStorage |
| `web/src/pages/paginasClient/Conta/conta.jsx` | Modificar | Adicionar edição de nome + toast de sucesso antes de redirecionar |
| `web/src/pages/paginasAdmin/contaAdmin/contaAdmin.jsx` | Criar | Página de conta do admin (reutiliza lógica de conta.jsx com ajuste de redirect) |
| `web/src/components/SidebarAdmin.jsx` | Modificar | Adicionar link "Minha Conta" antes do botão de logout |
| `web/src/rotas/rotas.jsx` | Modificar | Adicionar rota `/admin/conta` dentro do `AdminLayout` |

### 3.2 Backend: PUT /auth/me

```
PUT /auth/me
Authorization: Bearer {token}
Body: { full_name: string }
Response: { user: UserProfile }
```

- Valida que `full_name` não está vazio e tem no máximo 100 caracteres.
- Atualiza `profiles.full_name` e `profiles.updated_at` no Supabase.
- Retorna o perfil atualizado.
- Log de auditoria: apenas se for admin (ação `auth.update_profile`).

### 3.3 Fluxo de Alteração de Nome

1. Usuário edita o nome no campo "Nome" em Minha Conta
2. Clica em "Salvar nome"
3. Frontend chama `PUT /auth/me` com `{ full_name: novoNome }`
4. Backend atualiza no banco e retorna perfil atualizado
5. Frontend chama `updateUser({ full_name: novoNome })` no AuthContext
6. Toast de sucesso aparece por 3 segundos
7. O nome no sidebar é atualizado automaticamente (reativo ao contexto)

### 3.4 Fluxo de Alteração de Senha com Feedback

1. Usuário preenche campos de senha atual, nova senha, confirmação
2. Valida client-side (comprimento ≥ 8, confirmação confere)
3. Chama `POST /auth/change-password`
4. **Em caso de sucesso:** exibe toast verde "Senha alterada com sucesso!" por 2 segundos
5. Após o toast, chama `logout()` e redireciona para `/`

### 3.5 Página contaAdmin.jsx

- Idêntica a `conta.jsx` em estrutura e lógica.
- A diferença: está acessível via `/admin/conta` dentro do `AdminLayout` (sidebar admin visível).
- Pode importar e reutilizar diretamente o componente `Conta` — não precisa duplicar código, basta a rota + link na sidebar.

### 3.6 Tratamento de Erros

| Cenário | Resposta |
|---------|----------|
| `full_name` vazio | Erro client-side: "Nome não pode ficar em branco" |
| `full_name` > 100 chars | Erro client-side: "Nome muito longo" |
| Erro no servidor ao salvar nome | Toast vermelho com mensagem do backend |
| Senha atual incorreta | Mensagem de erro já tratada no backend |

---

## 4. Requisitos Funcionais

- **RF-001:** Admin deve ter link "Minha Conta" na sidebar, acessível a qualquer momento.
- **RF-002:** Rota `/admin/conta` deve renderizar a página de conta dentro do `AdminLayout`.
- **RF-003:** Página de conta deve exibir campo editável de nome (`full_name`).
- **RF-004:** Salvar nome deve atualizar o banco via `PUT /auth/me` e refletir na sidebar.
- **RF-005:** Após alterar senha com sucesso, exibir toast de confirmação antes de deslogar.
- **RF-006:** O `AuthContext` deve expor `updateUser(changes)` para atualização reativa.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Admin vê link "Minha Conta" na `SidebarAdmin` e consegue acessar `/admin/conta`.
- [ ] **CA-002:** A página de conta no admin mostra os dados do admin logado (nome, e-mail, empresa, perfil).
- [ ] **CA-003:** Admin consegue alterar sua própria senha pela página de conta.
- [ ] **CA-004:** Campo de nome é editável; salvar atualiza o banco e exibe sucesso.
- [ ] **CA-005:** Após alterar senha, toast verde aparece antes do logout/redirect.
- [ ] **CA-006:** Nome atualizado aparece imediatamente na sidebar sem reload da página.

---

## 6. Dependências

### 6.1 Internas
- Não depende da implementação 003 (podem ser feitas em paralelo).
- Usa o `AuthContext` existente em `web/src/context/AuthContext.jsx`.
- Usa o endpoint `/auth/me` existente (GET) e cria o (PUT).

### 6.2 Externas
- Nenhuma dependência de bibliotecas novas.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Duplicação de código entre conta.jsx e contaAdmin.jsx | Alta | Baixo | Reutilizar o componente `Conta` diretamente na rota admin em vez de criar novo arquivo |
| AuthContext stale após update de nome | Média | Médio | Implementar `updateUser()` que atualiza state + localStorage atomicamente |
