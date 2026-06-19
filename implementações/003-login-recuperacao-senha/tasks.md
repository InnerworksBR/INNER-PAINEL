# Tarefas: Login e Recuperação de Senha

> **Implementação:** 003
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 6/6 tarefas concluídas (100%)
> **Última atualização:** 2026-06-19

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Infraestrutura Supabase Client

- [x] **T-001:** Criar singleton do cliente Supabase para o frontend
  - **Descrição:** Criar o arquivo `web/src/lib/supabase.js` com a instância do Supabase client usando `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)`. Este cliente será usado exclusivamente para o fluxo de recuperação de senha.
  - **Arquivos envolvidos:** `web/src/lib/supabase.js` (criar)
  - **Critério de conclusão:** Arquivo criado e exportando o client sem erros de importação.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Melhorias no Login

- [x] **T-002:** Adicionar toggle mostrar/ocultar senha no login
  - **Descrição:** Adicionar botão com ícone `Eye`/`EyeOff` (Lucide) no campo de senha da tela `login.jsx`. Estado `showPassword` (useState) controla `type="password"` vs `type="text"`. Seguir o mesmo padrão visual já implementado em `conta.jsx` (PasswordField component).
  - **Arquivos envolvidos:** `web/src/pages/Login/login.jsx`
  - **Critério de conclusão:** Campo de senha do login tem botão funcional de mostrar/ocultar.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

- [x] **T-003:** Adicionar link "Esqueci minha senha" na tela de login
  - **Descrição:** Abaixo do campo de senha (antes do botão "Entrar"), adicionar link discreto `<Link to="/recuperar-senha">` com texto "Esqueci minha senha". Estilo: `text-white/60 hover:text-white/90 text-xs underline text-right`. Deve ser visível mas sem competir com o fluxo principal de login.
  - **Arquivos envolvidos:** `web/src/pages/Login/login.jsx`
  - **Critério de conclusão:** Link visível no formulário de login, navega para `/recuperar-senha`.
  - **Dependências:** T-005 (rota precisa existir)
  - **Estimativa:** Pequena

### Fase 3: Páginas de Recuperação

- [x] **T-004:** Criar página RecuperarSenha (`/recuperar-senha`)
  - **Descrição:** Criar `web/src/pages/RecuperarSenha/recuperarSenha.jsx`. Layout simples centrado (sem sidebar). Campos: e-mail. Ao submeter, chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/redefinir-senha' })`. Após envio (sucesso ou erro de rate limit), exibe mensagem: "Se este e-mail estiver cadastrado, você receberá um link em breve. Verifique também a pasta de spam." Botão "Voltar ao login" com link para `/`.
  - **Arquivos envolvidos:** `web/src/pages/RecuperarSenha/recuperarSenha.jsx` (criar), `web/src/lib/supabase.js`
  - **Critério de conclusão:** Página renderiza, aceita e-mail, exibe mensagem de sucesso após submit.
  - **Dependências:** T-001
  - **Estimativa:** Média

- [x] **T-005:** Criar página RedefinirSenha (`/redefinir-senha`)
  - **Descrição:** Criar `web/src/pages/RedefinirSenha/redefinirSenha.jsx`. Ao montar, chama `supabase.auth.onAuthStateChange` aguardando evento `PASSWORD_RECOVERY`. Enquanto aguarda: exibe loader "Verificando link...". Se o evento chegar, habilita formulário com campos "Nova senha" + "Confirmar nova senha" (toggle show/hide em ambos). Ao submeter: valida comprimento ≥ 8 e igualdade. Chama `supabase.auth.updateUser({ password })`. Em caso de sucesso: chama `supabase.auth.signOut()` e navega para `/` com `state: { passwordChanged: true }`. Se o link for inválido/expirado: exibir aviso com link para `/recuperar-senha`.
  - **Arquivos envolvidos:** `web/src/pages/RedefinirSenha/redefinirSenha.jsx` (criar), `web/src/lib/supabase.js`
  - **Critério de conclusão:** Página detecta token do Supabase, exibe formulário, altera senha e redireciona.
  - **Dependências:** T-001
  - **Estimativa:** Média

### Fase 4: Rotas

- [x] **T-006:** Registrar rotas públicas em rotas.jsx
  - **Descrição:** Adicionar em `web/src/rotas/rotas.jsx` duas rotas públicas (sem `ProtectedRoute`): `{ path: "/recuperar-senha", element: <RecuperarSenha /> }` e `{ path: "/redefinir-senha", element: <RedefinirSenha /> }`. Importar os componentes criados. As rotas devem ficar no nível raiz do router, ao lado de `/`.
  - **Arquivos envolvidos:** `web/src/rotas/rotas.jsx`
  - **Critério de conclusão:** Acessar `/recuperar-senha` e `/redefinir-senha` sem login renderiza as páginas corretas.
  - **Dependências:** T-004, T-005
  - **Estimativa:** Pequena

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001 | ✅ Concluída | 2026-06-19 | web/src/lib/supabase.js criado |
| T-002 | ✅ Concluída | 2026-06-19 | Toggle Eye/EyeOff adicionado em login.jsx |
| T-003 | ✅ Concluída | 2026-06-19 | Link "Esqueci minha senha" adicionado em login.jsx |
| T-004 | ✅ Concluída | 2026-06-19 | web/src/pages/RecuperarSenha/recuperarSenha.jsx criado |
| T-005 | ✅ Concluída | 2026-06-19 | web/src/pages/RedefinirSenha/redefinirSenha.jsx criado |
| T-006 | ✅ Concluída | 2026-06-19 | Rotas /recuperar-senha e /redefinir-senha registradas em rotas.jsx |

---

> **⚠️ Configuração necessária no Supabase Dashboard antes de testar:**
> Em Authentication → URL Configuration → Redirect URLs, adicionar:
> - `http://localhost:5173/redefinir-senha` (dev)
> - `https://SEU_DOMINIO/redefinir-senha` (prod)
