# Especificação: Gestão de Usuários e UX Admin

> **ID:** 005
> **Status:** 🟡 Planejada
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-06-19
> **Última atualização:** 2026-06-19

---

## 1. Resumo Executivo

Série de melhorias na tela de Gestão de Usuários (`usuariosAdmin.jsx`) e polimentos de UX no painel admin: exibir e-mail na tabela, busca por e-mail, confirmação de senha no reset, feedback auto-limpante, cards do dashboard admin clicáveis e validação de timeout na tela de configurações.

---

## 2. Contexto e Motivação

### 2.1 Problema Atual

**Gestão de Usuários:**
- A tabela de usuários não exibe o e-mail — só mostra nome e UUID, tornando difícil identificar um usuário quando há nomes duplicados ou similares.
- A busca só filtra por `full_name`; não é possível buscar por e-mail.
- O modal de "Redefinir Senha" tem apenas um campo (`nova senha`), sem confirmação — risco de typo.
- O modal de edição não mostra o e-mail atual do usuário como referência.
- Mensagens de feedback (sucesso/erro) não somem sozinhas — acumulam e confundem.

**Dashboard Admin:**
- Os 4 cards de estatísticas (Empresas, Usuários, Documentos, Saúde) são visuais mas não são clicáveis. O admin precisa navegar manualmente pelo sidebar.

**Configurações:**
- O campo "Timeout de Sessão" não tem limite máximo (pode ser definido para valores absurdos como 99999 minutos).
- Não há validação de campos obrigatórios antes de salvar.

### 2.2 Impacto do Problema

- Admins perdem tempo procurando usuários por nome quando o e-mail é a chave mais única.
- Reset de senha com typo obriga novo reset desnecessário.
- Dashboard admin exige mais cliques para navegação do que o necessário.

---

## 3. Especificação Técnica

### 3.1 Componentes Afetados

| Componente | Ação | Descrição |
|-----------|------|-----------|
| `web/src/pages/paginasAdmin/usuariosAdmin/usuariosAdmin.jsx` | Modificar | Email na tabela, busca por email, confirm senha no reset, feedback auto-clear, empty state |
| `web/src/pages/paginasAdmin/dashAdmin/dashAdmin.jsx` | Modificar | Cards clicáveis com useNavigate |
| `web/src/pages/paginasAdmin/configAdmin/configAdmin.jsx` | Modificar | Timeout com max=480, validação de nome de sistema não-vazio |

### 3.2 Detalhes: usuariosAdmin.jsx

**Tabela de usuários — nova coluna E-mail:**
- Adicionar coluna "E-mail" entre "Perfil" e "Status" (ou após "Nome").
- Exibir `user.email` — o campo vem da query `supabaseAdmin.from('profiles').select('*, companies(name)')`.
- **Verificar:** o campo `email` precisa ser adicionado ao SELECT ou join no backend em `admin/users-routes.ts`.

**Backend — verificar email no SELECT:**
- A rota GET `/admin/users` faz `select('*, companies(name)')` na tabela `profiles`.
- O campo `email` pode não estar na tabela `profiles` (pode estar apenas em `auth.users`).
- Se não vier automaticamente, adicionar lógica no backend para incluir o e-mail (join com auth.users via supabaseAdmin ou adicionar campo email na tabela profiles).

**Busca por e-mail:**
- Alterar o filtro `filteredUsers` para verificar tanto `full_name` quanto `email`.

**Modal de edição — e-mail como referência:**
- Exibir o e-mail do usuário como texto read-only no topo do modal de edição (não editável, apenas para referência visual).

**Modal de reset de senha — confirmação:**
- Adicionar segundo campo "Confirmar nova senha".
- Validar que os dois campos coincidem antes de enviar.
- Exibir hint "Mínimo 8 caracteres".

**Feedback auto-clear:**
- Após setFeedback com sucesso ou erro, disparar setTimeout de 5000ms para limpar.
- Cancelar o timeout anterior se novo feedback for definido (usar useRef para o timer).

**Empty state na tabela:**
- Quando `filteredUsers.length === 0` e não está carregando, exibir linha com mensagem clara: "Nenhum usuário encontrado com os filtros aplicados."

**Contador de resultados:**
- No cabeçalho da seção da tabela, exibir "X usuário(s) encontrado(s)" baseado em `filteredUsers.length`.

### 3.3 Detalhes: dashAdmin.jsx

- Importar `useNavigate` de `react-router-dom`.
- Adicionar `path` em cada card: Empresas → `/admin/empresasAdmin`, Usuários → `/admin/usuariosAdmin`, Documentos → `/admin/docAdmin`, Saúde Operacional → `/admin/auditAdmin`.
- Cards ficam clicáveis com `cursor-pointer` e hover state mais pronunciado.

### 3.4 Detalhes: configAdmin.jsx

- Campo timeout: adicionar `max={480}` (8 horas máximo) e `min={5}`.
- Validação antes de salvar: se `systemName.trim() === ''`, exibir erro.
- Validação: se `sessionTimeout < 5 || sessionTimeout > 480`, exibir erro antes de salvar.

### 3.5 Backend: verificar email na listagem de usuários

O campo `email` em Supabase fica na tabela `auth.users`, não em `profiles`. Opções:
- **Opção A (recomendada):** Após buscar profiles, enriquecer com emails via `supabaseAdmin.auth.admin.listUsers()` e fazer merge por ID.
- **Opção B:** Adicionar campo `email` na tabela `profiles` e populá-lo no momento de criação/atualização.

Para esta implementação, usar **Opção A** (sem migração de banco).

---

## 4. Requisitos Funcionais

- **RF-001:** Tabela de usuários exibe coluna "E-mail" com o e-mail de cada usuário.
- **RF-002:** Campo de busca filtra por nome e por e-mail simultaneamente.
- **RF-003:** Modal de edição exibe e-mail atual do usuário como campo read-only.
- **RF-004:** Modal de reset de senha tem dois campos: nova senha + confirmação, com validação.
- **RF-005:** Mensagens de feedback somem automaticamente após 5 segundos.
- **RF-006:** Tabela exibe estado vazio quando não há usuários nos filtros.
- **RF-007:** Cards do dashboard admin são clicáveis e navegam para a seção correspondente.
- **RF-008:** Timeout de sessão aceita apenas valores entre 5 e 480 minutos.
- **RF-009:** Salvar configurações valida que nome do sistema não está vazio.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Coluna de e-mail visível na tabela de usuários com os dados corretos.
- [ ] **CA-002:** Buscar pelo e-mail de um usuário retorna o usuário correto.
- [ ] **CA-003:** Modal de edição mostra o e-mail atual do usuário.
- [ ] **CA-004:** Modal de reset exige confirmação de senha e valida que coincidem.
- [ ] **CA-005:** Mensagens de sucesso e erro desaparecem após 5 segundos.
- [ ] **CA-006:** Com filtros sem resultado, tabela mostra mensagem de vazio.
- [ ] **CA-007:** Clicar no card "Empresas" navega para `/admin/empresasAdmin`, e assim por diante.
- [ ] **CA-008:** Tentar salvar timeout = 0 ou > 480 exibe erro de validação.

---

## 6. Dependências

### 6.1 Internas
- Backend: `admin/users-routes.ts` — precisará ser ajustado para incluir email.
- Independente das implementações 003 e 004.

### 6.2 Externas
- `supabaseAdmin.auth.admin.listUsers()` — disponível com a service role key (já configurada no backend).

---

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| `listUsers()` tem paginação (limite de 50/100 usuários) | Baixa | Médio | Implementar paginação no merge ou limitar a primeiros 1000 usuários |
| Campo email pode não existir em profiles | Alta | Alto | Usar merge com auth.users no backend conforme Opção A da spec |
| Colunas da tabela ficarem muito apertadas com e-mail | Média | Baixo | Usar `text-ellipsis` e truncate para e-mails longos |
