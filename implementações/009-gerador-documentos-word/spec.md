# Gerador de Documentos Word

> **ID:** 009
> **Status:** 🟡 Planejada
> **Prioridade:** 🟠 Alta
> **Criada em:** 2026-07-07
> **Última atualização:** 2026-07-07
> **Autor:** Agente AI (a pedido do time Inner)

---

## 1. Resumo Executivo

Ferramenta interna no painel admin onde o técnico cola um texto em markdown (gerado por IA ou escrito manualmente) e o sistema gera um arquivo `.docx` já formatado no template padrão da empresa (capa, cabeçalho/rodapé, estilos de título, tabelas). Elimina os 30–60 minutos de formatação manual por documento. Opcionalmente, o documento gerado pode ser publicado direto na Documentação do cliente, reusando o fluxo de storage existente.

## 2. Contexto e Motivação

### 2.1 Problema Atual
O time produz documentação técnica e comercial com auxílio de IA (saída em markdown/texto puro). A transposição para o Word padrão da empresa é manual: aplicar estilos de título, montar capa, ajustar tabelas, cabeçalho/rodapé. Cada documento consome de 30 minutos a 1 hora só de formatação.

### 2.2 Impacto do Problema
Todo o time técnico/comercial é afetado, em tarefa recorrente (várias vezes por semana). O tempo gasto em formatação não agrega valor e desestimula a produção de documentação — o que degrada a base documental dos clientes no portal.

### 2.3 Soluções Consideradas

| Solução | Prós | Contras | Decisão |
|---------|------|---------|---------|
| Template .docx da empresa + `patchDocument` da lib `docx` (conteúdo markdown convertido para elementos Word usando os estilos nomeados do template) | Fidelidade total ao padrão visual; troca de template sem mexer em código; capa/cabeçalho/rodapé preservados | Exige manter placeholders no template | ✅ Escolhida |
| Construir estilos 100% em código com a lib `docx` | Sem dependência de arquivo de template | Qualquer mudança de identidade visual vira alteração de código | ❌ Descartada |
| `docxtemplater` (motor de templates) | Bom para campos fixos | Fraco para conteúdo longo e fluido (markdown arbitrário com títulos/listas/tabelas); licença paga para módulos avançados | ❌ Descartada |
| Geração de HTML + conversão externa (LibreOffice/pandoc) | Flexível | Dependência de binário externo no servidor; deploy mais frágil | ❌ Descartada |

## 3. Especificação Técnica

### 3.1 Visão Geral da Arquitetura

Geração 100% server-side no backend Fastify existente:

```
[Admin: página Gerador]                      [Backend Fastify]
  título, cliente, categoria,      POST        /api/admin/docs/generate
  markdown, flag publicar   ───────────────►   doc-generator-service
                                                 1. marked → AST do markdown
                                                 2. AST → elementos docx (Paragraph,
                                                    Table...) usando estilos nomeados
                                                    do template (Heading1, Heading2...)
                                                 3. patchDocument(template.docx):
                                                    {{titulo}} {{cliente}} {{data}}
                                                    {{versao}} {{conteudo}}
                                               ◄── retorna buffer .docx (download)
                                                    ou publica via storage-service
                                                    + registro em `documents`
```

### 3.2 Componentes Afetados

| Componente | Tipo | Ação | Descrição |
|-----------|------|------|-----------|
| `backend/templates/modelo-padrao.docx` | Arquivo | Criar | Template oficial da empresa com placeholders (fornecido pelo time) |
| `backend/src/services/doc-generator-service.ts` | Serviço | Criar | Parse do markdown e geração do .docx via template |
| `backend/src/routes/admin/docs-routes.ts` | Rota | Modificar | Nova rota `POST /api/admin/docs/generate` |
| `backend/package.json` | Config | Modificar | Dependências `docx` e `marked` |
| `web/src/pages/paginasAdmin/geradorAdmin/geradorAdmin.jsx` | Página | Criar | Formulário + editor markdown + preview + ações |
| `web/src/rotas/rotas.jsx` | Rota | Modificar | Rota `/admin/geradorAdmin` |
| `web/src/components/SidebarAdmin.jsx` | Componente | Modificar | Item "Gerador de Docs" |
| `implementações/README.md` | Doc | Modificar | Registrar implementação 009 no índice |

### 3.3 Interfaces e Contratos

#### Entradas
`POST /api/admin/docs/generate` (JSON, autenticado admin):

```json
{
  "titulo": "string (obrigatório, 3–150 chars)",
  "cliente": "string (opcional — nome livre ou vindo do select de empresas)",
  "versao": "string (opcional, default \"1.0\")",
  "conteudo": "string markdown (obrigatório, máx. 500 KB)",
  "publicar": "boolean (default false)",
  "company_id": "uuid (obrigatório se publicar=true)",
  "categoria": "string (obrigatório se publicar=true — categorias existentes de documents)"
}
```

#### Saídas
- `publicar=false`: resposta binária `application/vnd.openxmlformats-officedocument.wordprocessingml.document` com `Content-Disposition: attachment; filename="<slug-do-titulo>.docx"`.
- `publicar=true`: `201` com o registro criado em `documents` (JSON), arquivo salvo via `storage-service` no bucket de documentos.
- Erro de validação: `400` com mensagem específica. Template ausente/corrompido: `500` com mensagem "Template padrão não encontrado/inválido".

#### Contratos de API (se aplicável)
Rota protegida pelos hooks existentes (`fastify.authenticate` + `verifyAdmin`). Ação registrada no `admin_audit_logs` via `audit-service` (action: `generate_document`, summary com título e se foi publicado).

### 3.4 Modelos de Dados (se aplicável)
Nenhuma tabela nova. Publicação reusa a tabela `documents` existente (title, category, company_id, file_url).

**Contrato do template** (`modelo-padrao.docx`): deve conter os placeholders de texto `{{titulo}}`, `{{cliente}}`, `{{data}}`, `{{versao}}` (capa/cabeçalho) e `{{conteudo}}` (ponto de injeção do corpo), e definir os estilos nomeados: `Heading1`, `Heading2`, `Heading3`, `Normal`, estilo de tabela padrão e estilo de bloco de código (`CodeBlock`, se existir; senão fonte mono aplicada inline).

### 3.5 Fluxo de Execução
1. Admin acessa `/admin/geradorAdmin`, preenche título, cliente (select de empresas ou texto livre), versão e cola o markdown.
2. Preview renderiza o markdown no navegador (aproximação visual, não fidelidade Word).
3. Ao clicar **Gerar Word**: front envia `publicar=false`, recebe o binário e dispara o download.
4. Ao clicar **Publicar na Documentação**: front exige empresa + categoria, envia `publicar=true`; backend gera, sobe pro storage, cria registro em `documents` e retorna confirmação. Documento aparece imediatamente na Documentação do cliente.
5. Backend, em ambos os casos: valida payload → carrega template do disco → converte markdown em elementos docx mapeando estilos → `patchDocument` injeta capa e conteúdo → retorna/persiste.

### 3.6 Tratamento de Erros
- Markdown vazio ou título ausente → 400 com mensagem inline no formulário.
- Elemento markdown não suportado (ex.: imagem remota, HTML embutido) → ignorado com aviso na resposta (`warnings: []`), exibido como toast "Documento gerado; N elementos não suportados foram ignorados".
- Template ausente no disco → 500 claro; front exibe erro com orientação ("Template padrão não configurado no servidor").
- Falha de upload na publicação → documento ainda é devolvido para download local (fallback), erro informado.

## 4. Requisitos

### 4.1 Requisitos Funcionais
- **RF-001:** Admin cola markdown e baixa `.docx` formatado no template da empresa.
- **RF-002:** Suporte aos elementos: títulos (h1–h3), parágrafos, negrito/itálico, listas ordenadas/não ordenadas (2 níveis), tabelas, blocos de código, citações, linha horizontal e links.
- **RF-003:** Capa preenchida automaticamente com título, cliente, data (dd/mm/aaaa) e versão.
- **RF-004:** Preview do markdown na tela antes de gerar.
- **RF-005:** Opção "Publicar na Documentação" cria o documento no portal do cliente (empresa + categoria obrigatórias) reusando storage e tabela `documents`.
- **RF-006:** Ação registrada na auditoria admin.
- **RF-007:** Template é universal — um único modelo serve para qualquer tipo de documento.

### 4.2 Requisitos Não-Funcionais
- **RNF-001:** Geração em < 5 s para documentos de até 50 páginas.
- **RNF-002:** Rota acessível apenas a admins (hooks existentes).
- **RNF-003:** Sem dependência de binários externos (LibreOffice/pandoc) — apenas libs npm.
- **RNF-004:** Payload de markdown limitado a 500 KB.

### 4.3 Restrições e Limitações
- Preview no navegador é aproximado (fontes/margens do Word não são replicadas).
- Imagens embutidas no markdown ficam fora do escopo desta versão (ignoradas com aviso).
- Exportação em PDF fica fora do escopo (registrada como evolução futura — exigiria conversor externo).
- Depende do arquivo de template fornecido pelo time com os placeholders da seção 3.4.

## 5. Critérios de Aceitação

- [ ] **CA-001:** Colar um markdown com h1/h2/h3, listas, tabela e código gera um .docx que abre sem erros no Word e usa os estilos do template.
- [ ] **CA-002:** Capa exibe título, cliente, data e versão preenchidos; cabeçalho/rodapé do template preservados; numeração de página intacta.
- [ ] **CA-003:** "Publicar na Documentação" cria registro visível na tela Documentação do cliente da empresa escolhida, com download funcional.
- [ ] **CA-004:** Usuário client não acessa a rota nem a página (403/redirect).
- [ ] **CA-005:** Markdown com elemento não suportado gera documento mesmo assim, com aviso de itens ignorados.
- [ ] **CA-006:** Ação aparece em `/admin/auditAdmin`.

## 6. Plano de Testes

### 6.1 Testes Unitários
`doc-generator-service`: mapeamento AST→docx por tipo de elemento (heading, lista aninhada, tabela, código, negrito/itálico combinados); sanitização do nome de arquivo; validação de payload.

### 6.2 Testes de Integração
Rota `POST /api/admin/docs/generate` com token admin (download binário válido — magic bytes PK) e com `publicar=true` (registro em `documents` criado, arquivo no storage). Token client → 403.

### 6.3 Testes de Aceitação
Gerar documento real a partir de uma saída de IA típica (doc técnica com tabelas) e abrir no Word/LibreOffice conferindo os CA-001/002. Publicar para uma empresa de teste e validar na visão preview do cliente.

### 6.4 Casos de Borda (Edge Cases)
- Markdown de 1 linha (mínimo) e de 500 KB (máximo).
- Tabela com células vazias e com pipe escapado.
- Títulos pulando nível (h1 → h3).
- Caracteres acentuados/emoji no título (nome de arquivo sanitizado).
- Dois cliques rápidos em Gerar (sem duplicar publicação).

## 7. Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Template sem os estilos nomeados esperados → documento sem formatação | Média | Alto | T-001 valida o template e documenta o contrato de placeholders/estilos; erro claro no startup se ausente |
| `patchDocument` não preservar alguma seção do template (ex.: sumário) | Baixa | Médio | Validar com o template real na T-004 antes de seguir para o front |
| Saídas de IA com HTML embutido no markdown | Média | Baixo | Ignorar com aviso (RF na seção 3.6) |

## 8. Dependências

### 8.1 Dependências Internas
Nenhuma implementação pré-requisito. Reusa `storage-service`, `audit-service` e a tabela `documents` (já existentes).

### 8.2 Dependências Externas
- **Insumo do time:** arquivo `modelo-padrao.docx` oficial da empresa, ajustado com os placeholders (bloqueia T-001).
- Bibliotecas npm: `docx` (geração/patch) e `marked` (parse do markdown) — licenças MIT.

## 9. Observações e Decisões de Design

- Template único e universal por decisão do time (2026-07-07) — sem seleção de "tipo de documento" na UI.
- Template versionado no repositório (`backend/templates/`). Evolução futura: upload do template pela tela de Configurações.
- Evoluções futuras registradas: exportação PDF, suporte a imagens, múltiplos templates.
- A geração é stateless: nada é persistido quando `publicar=false`.

---

> **⚠️ NOTA:** Este documento é a fonte de verdade para esta implementação.
> Qualquer alteração no escopo deve ser refletida aqui ANTES de ser implementada.
