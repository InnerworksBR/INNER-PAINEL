# Especificação: Login e Recuperação de Senha

> **ID:** 003
> **Status:** 🟡 Planejada
> **Prioridade:** 🔴 Crítica
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Melhoria completa do fluxo de autenticação do portal: adicionar toggle de mostrar/ocultar senha no login, e implementar o fluxo completo de recuperação de senha via e-mail (esqueci minha senha + redefinição via link Supabase). Atualmente usuários que esquecem a senha precisam acionar um admin para redefinição manual, o que é ineficiente e ruim para a experiência.

---

## 2. Contexto e Motivação

### 2.1 Problema Atual

- O campo de senha no login não tem toggle de visibilidade — único campo de texto sem confirmação visual do que foi digitado.
- Não existe fluxo de "Esqueci minha senha". Se o usuário esquece a senha, precisa contatar o administrador que acessa a tela de Gestão de Usuários e faz um reset manual.
- Não existe página de redefinição de senha acessível sem autenticação.

### 2.2 Impacto do Problema

- Usuários clientes ficam bloqueados sem autonomia para recuperar acesso.
- Admins recebem demandas desnecessárias de reset.
- Aumenta abandono na tela de login quando a senha é esquecida.

### 2.3 Solução Adotada

Usar o fluxo nativo de recuperação de senha do **Supabase Auth** via `@supabase/supabase-js` (já instalado no frontend). O Supabase envia e-mail com link de recuperação; ao clicar, o usuário cai em `/redefinir-senha` onde define a nova senha diretamente pelo cliente Supabase (sem precisar do backend JWT para este fluxo).

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `web/src/pages/Login/login.jsx` | Modificar | Adicionar toggle mostrar/ocultar senha + link "Esqueci minha senha" |
| `web/src/lib/supabase.js` | Criar | Singleton do cliente Supabase para uso no frontend |
| `web/src/pages/RecuperarSenha/recuperarSenha.jsx` | Criar | Página com campo de e-mail para solicitar recuperação |
| `web/src/pages/RedefinirSenha/redefinirSenha.jsx` | Criar | Página para definir nova senha após clicar no link do e-mail |
| `web/src/rotas/rotas.jsx` | Modificar | Adicionar rotas `/recuperar-senha` e `/redefinir-senha` (públicas) |

### 3.2 Fluxo de Execução

**Fluxo "Esqueci minha senha":**
1. Usuário clica em "Esqueci minha senha" no login
2. Redireciona para `/recuperar-senha`
3. Usuário informa o e-mail e clica em "Enviar"
4. Frontend chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: SITE_URL + '/redefinir-senha' })`
5. Supabase envia e-mail com link de recuperação
6. Exibe mensagem de sucesso ("Verifique seu e-mail")

**Fluxo "Redefinir senha" (após clicar no link do e-mail):**
1. Usuário clica no link do e-mail → cai em `/redefinir-senha?...` com tokens na URL
2. Página lê `access_token` do hash da URL via `supabase.auth.onAuthStateChange`
3. Quando detecta evento `PASSWORD_RECOVERY`, habilita formulário
4. Usuário preenche nova senha + confirmação
5. Chama `supabase.auth.updateUser({ password: novaSenha })`
6. Chama `supabase.auth.signOut()` e redireciona para `/` com state `{ passwordChanged: true }`

### 3.3 Variáveis de Ambiente Necessárias

- `VITE_SUPABASE_URL` — já existe em `web/.env`
- `VITE_SUPABASE_ANON_KEY` — já existe em `web/.env`

### 3.4 Tratamento de Erros

| Cenário | Resposta |
|---------|----------|
| E-mail não cadastrado | Supabase retorna sucesso (por segurança, não revelamos se existe) |
| Link expirado | `onAuthStateChange` não retorna `PASSWORD_RECOVERY`; exibir aviso e link para solicitar novo |
| Nova senha < 8 caracteres | Validação client-side antes de chamar Supabase |
| Nova senha ≠ confirmação | Validação client-side, exibir erro |
| Erro de rede | Mensagem genérica de erro |

---

## 4. Requisitos Funcionais

- **RF-001:** Campo de senha no login deve ter botão de toggle olho (mostrar/ocultar).
- **RF-002:** Deve existir link "Esqueci minha senha" abaixo do campo de senha na tela de login.
- **RF-003:** Página `/recuperar-senha` deve aceitar e-mail e enviar link via Supabase.
- **RF-004:** Página exibe mensagem de sucesso após envio do e-mail (independente se e-mail existe).
- **RF-005:** Página `/redefinir-senha` deve capturar o token do Supabase via URL e habilitar formulário.
- **RF-006:** Formulário de redefinição deve exigir nova senha e confirmação.
- **RF-007:** Após redefinição bem-sucedida, redirecionar para `/` com mensagem de senha alterada.
- **RF-008:** Ambas as páginas novas devem ser acessíveis sem autenticação (rotas públicas).

## 5. Critérios de Aceitação

- [ ] **CA-001:** Login tem botão olho que alterna visibilidade do campo de senha.
- [ ] **CA-002:** Link "Esqueci minha senha" leva para `/recuperar-senha`.
- [ ] **CA-003:** Informar e-mail válido em `/recuperar-senha` exibe mensagem de sucesso.
- [ ] **CA-004:** Clicar no link do e-mail enviado abre `/redefinir-senha` e habilita o formulário.
- [ ] **CA-005:** Definir nova senha válida atualiza a senha e redireciona para o login.
- [ ] **CA-006:** Login exibe "Senha alterada. Entre novamente." após redefinição.
- [ ] **CA-007:** Páginas `/recuperar-senha` e `/redefinir-senha` não exigem login.

---

## 6. Dependências

### 6.1 Internas
- `@supabase/supabase-js` — já instalado no frontend (`web/package.json`)
- Variáveis `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` — já presentes em `web/.env`

### 6.2 Externas
- Supabase Auth deve ter o e-mail de recuperação habilitado no dashboard do projeto Supabase.
- A URL de redirect (`VITE_SITE_URL` ou hardcoded) deve estar na allowlist do Supabase → Authentication → URL Configuration.

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| URL de redirect não está na allowlist Supabase | Média | Alto | Documentar configuração necessária no Supabase dashboard |
| E-mail de recuperação vai para spam | Baixa | Médio | Usar domínio próprio configurado no Supabase (SMTP customizado) |
| Link do e-mail expira antes do usuário acessar | Baixa | Baixo | Exibir aviso e botão "Solicitar novo link" na página de redefinição |

---

> **⚠️ NOTA:** Antes de testar em produção, configurar a URL `https://SEU_DOMINIO/redefinir-senha` na allowlist de redirects do projeto Supabase em Authentication → URL Configuration.
