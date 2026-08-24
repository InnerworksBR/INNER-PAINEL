# Tarefas: Gerador de Documentos Word

> **Implementação:** 009 - Gerador de Documentos Word
> **Spec:** [spec.md](./spec.md)
> **Progresso:** 0/10 tarefas concluídas (0%)
> **Última atualização:** 2026-07-07

---

## Legenda

- `[ ]` — Pendente
- `[x]` — Concluída
- `[!]` — Bloqueada (ver observação)
- `[-]` — Cancelada

---

## Tarefas

### Fase 1: Preparação e Setup

- [!] **T-001:** Adicionar template oficial com placeholders
  - **Descrição:** Receber o `.docx` oficial do time, inserir os placeholders `{{titulo}}`, `{{cliente}}`, `{{data}}`, `{{versao}}` (capa/cabeçalho) e `{{conteudo}}` (corpo), validar que os estilos nomeados `Heading1/2/3`, `Normal` e tabela padrão existem, e salvar em `backend/templates/modelo-padrao.docx`.
  - **Arquivos envolvidos:** `backend/templates/modelo-padrao.docx`
  - **Critério de conclusão:** Template no repositório, abrindo sem erro no Word, com todos os placeholders e estilos do contrato (spec §3.4).
  - **Dependências:** Nenhuma (insumo externo: arquivo do time)
  - **Estimativa:** Pequena
  - **Observações:** 🔒 Bloqueada até o time fornecer o arquivo. As T-002/T-003 podem andar em paralelo com um template provisório.

- [ ] **T-002:** Instalar dependências no backend
  - **Descrição:** Adicionar `docx` e `marked` ao `backend/package.json` e conferir build TypeScript (`npx tsc --noEmit`).
  - **Arquivos envolvidos:** `backend/package.json`
  - **Critério de conclusão:** Dependências instaladas e build passando.
  - **Dependências:** Nenhuma
  - **Estimativa:** Pequena

### Fase 2: Implementação Core (Backend)

- [ ] **T-003:** Conversor markdown → elementos docx
  - **Descrição:** Em `doc-generator-service.ts`, usar o AST do `marked` para converter h1–h3, parágrafos, negrito/itálico, listas (2 níveis), tabelas, código, citações, hr e links em elementos da lib `docx`, referenciando os estilos nomeados do template. Elementos não suportados são ignorados e acumulados em `warnings[]`.
  - **Arquivos envolvidos:** `backend/src/services/doc-generator-service.ts`
  - **Critério de conclusão:** Função pura `markdownToDocxElements(md): { elements, warnings }` coberta por testes unitários dos tipos listados.
  - **Dependências:** T-002
  - **Estimativa:** Grande

- [ ] **T-004:** Geração via template com patchDocument
  - **Descrição:** Carregar `modelo-padrao.docx`, aplicar `patchDocument` preenchendo `{{titulo}}`, `{{cliente}}`, `{{data}}`, `{{versao}}` e injetando os elementos do T-003 em `{{conteudo}}`. Validar com o template real que capa, cabeçalho/rodapé e numeração são preservados.
  - **Arquivos envolvidos:** `backend/src/services/doc-generator-service.ts`
  - **Critério de conclusão:** `generateDocument(payload): Buffer` retorna .docx válido que abre no Word com formatação do template (CA-001/CA-002).
  - **Dependências:** T-001, T-003
  - **Estimativa:** Média

- [ ] **T-005:** Rota POST /api/admin/docs/generate (download)
  - **Descrição:** Nova rota em `docs-routes.ts` (admin): validação do payload (spec §3.3), chamada ao serviço, resposta binária com `Content-Disposition` e nome de arquivo sanitizado. Registrar em `audit-service` (action `generate_document`).
  - **Arquivos envolvidos:** `backend/src/routes/admin/docs-routes.ts`
  - **Critério de conclusão:** Download funcional via token admin; 400 para payload inválido; 403 para client; log na auditoria.
  - **Dependências:** T-004
  - **Estimativa:** Média

- [ ] **T-006:** Fluxo publicar na Documentação
  - **Descrição:** Com `publicar=true` (+ `company_id` e `categoria` obrigatórios), subir o buffer via `storage-service`, criar registro em `documents` e retornar 201 com o registro. Em falha de upload, devolver o arquivo para download com erro informado (fallback da spec §3.6).
  - **Arquivos envolvidos:** `backend/src/routes/admin/docs-routes.ts`, `backend/src/services/doc-generator-service.ts`
  - **Critério de conclusão:** Documento aparece na tela Documentação do cliente da empresa escolhida com download OK (CA-003).
  - **Dependências:** T-005
  - **Estimativa:** Média

### Fase 3: Frontend

- [ ] **T-007:** Página Gerador de Documentos
  - **Descrição:** Criar `geradorAdmin.jsx` seguindo o padrão visual das telas admin: campos título, cliente (select de empresas + opção texto livre), versão, categoria (para publicação), textarea de markdown e preview renderizado lado a lado (desktop) / em abas (mobile).
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/geradorAdmin/geradorAdmin.jsx`
  - **Critério de conclusão:** Página renderiza com preview reativo do markdown e validação inline dos campos obrigatórios.
  - **Dependências:** Nenhuma (pode andar em paralelo ao backend)
  - **Estimativa:** Grande

- [ ] **T-008:** Ações Gerar Word e Publicar + feedback
  - **Descrição:** Integrar com a API: botão "Gerar Word" baixa o arquivo (blob → download); botão "Publicar na Documentação" exige empresa+categoria e exibe toast de sucesso/erro com auto-dismiss (padrão impl. 005/008). Exibir `warnings` de elementos ignorados. Desabilitar botões durante a requisição (evitar duplo clique).
  - **Arquivos envolvidos:** `web/src/pages/paginasAdmin/geradorAdmin/geradorAdmin.jsx`, `web/src/services/api.js`
  - **Critério de conclusão:** Download e publicação funcionais com feedback; CA-005 atendido.
  - **Dependências:** T-005, T-006, T-007
  - **Estimativa:** Média

- [ ] **T-009:** Rota e item na sidebar admin
  - **Descrição:** Registrar `/admin/geradorAdmin` em `rotas.jsx` (AdminRoute) e adicionar item "Gerador de Docs" (ícone FileText/FilePen do Lucide) em `SidebarAdmin.jsx`.
  - **Arquivos envolvidos:** `web/src/rotas/rotas.jsx`, `web/src/components/SidebarAdmin.jsx`
  - **Critério de conclusão:** Navegação funcional; rota inacessível para role client (CA-004).
  - **Dependências:** T-007
  - **Estimativa:** Pequena

### Fase 4: Testes e Finalização

- [ ] **T-010:** Validação ponta a ponta e índice
  - **Descrição:** Gerar documento real a partir de saída de IA típica (com tabelas e código), abrir no Word conferindo CA-001/002; publicar em empresa de teste e validar no preview do cliente; conferir auditoria (CA-006). Atualizar `implementações/README.md` (status/progresso) e marcar a spec como Concluída.
  - **Arquivos envolvidos:** `implementações/README.md`, `implementações/009-gerador-documentos-word/spec.md`
  - **Critério de conclusão:** Todos os CA marcados na spec; índice atualizado.
  - **Dependências:** T-001..T-009
  - **Estimativa:** Média

---

## Registro de Progresso

| Tarefa | Status | Data de Conclusão | Observações |
|--------|--------|-------------------|-------------|
| T-001  | 🔒 Bloqueada | — | Aguardando template .docx do time |
| T-002  | ⬜ Pendente | — | — |
| T-003  | ⬜ Pendente | — | — |
| T-004  | ⬜ Pendente | — | — |
| T-005  | ⬜ Pendente | — | — |
| T-006  | ⬜ Pendente | — | — |
| T-007  | ⬜ Pendente | — | — |
| T-008  | ⬜ Pendente | — | — |
| T-009  | ⬜ Pendente | — | — |
| T-010  | ⬜ Pendente | — | — |

---

> **📌 NOTA:** Atualize este documento conforme as tarefas forem concluídas.
> Marque `[x]` nas tarefas finalizadas e atualize a tabela de progresso.
