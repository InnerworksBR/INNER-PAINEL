# Spec — Visualização do Cliente dentro do Painel Administrativo

## 1. Objetivo

Permitir que um usuário administrador visualize, a partir do painel administrativo, exatamente a experiência e os dados que um cliente específico enxerga no portal.

A implementação deve resolver dois problemas ao mesmo tempo:

1. dar ao time interno uma forma rápida de conferir o ambiente de cada empresa sem precisar entrar com credenciais de cliente;
2. preservar o isolamento de dados entre empresas, evitando que o modo admin mostre dados globais quando a intenção é inspecionar apenas um cliente.

## 2. Contexto atual identificado no projeto

### Frontend

- O painel administrativo usa `AdminLayout` e está sob `/admin`.
- A experiência do cliente usa `Layout` e está sob `/app`.
- As telas de cliente já existem e são reaproveitáveis:
  - Dashboard
  - Microsoft 365
  - Servidores
  - Rede
  - Documentação
  - Chamados GLPI
- A listagem de empresas está em `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`.
- O admin já possui um contexto de empresas via `CompanyContext`.

### Backend

- As rotas de cliente ficam em `backend/src/routes/client/*`.
- Hoje, várias rotas já aceitam `admin`, mas quando o usuário é admin elas não filtram por empresa; retornam a visão global.
- Exemplo importante:
  - `GET /client/dashboard/summary`
  - `GET /client/metrics/ms365`
  - `GET /client/metrics/servers`
- Isso significa que simplesmente renderizar as páginas de cliente dentro do admin não basta: é necessário introduzir um escopo explícito de empresa para o modo de visualização.

## 3. Problema a resolver

Hoje o administrador consegue gerenciar empresas e integrações, mas não consegue ver com fidelidade o que um cliente específico está vendo.

Sem uma solução dedicada, existem dois riscos:

- o admin precisar alternar contas manualmente para validar o portal de cada cliente;
- uma tentativa de reaproveitar as telas atuais sem escopo acabar exibindo dados de todas as empresas, o que invalida a conferência.

## 4. Proposta de solução

Criar um recurso de **“Visualizar como cliente”** dentro do admin.

### Experiência desejada

Na tela de gestão de empresas, cada empresa terá uma ação visual adicional, por exemplo um ícone de olho ou um botão “Visualizar portal”. Ao clicar:

1. o admin escolhe implicitamente aquela empresa como contexto de visualização;
2. o sistema abre uma área administrativa própria, por exemplo:
   - `/admin/empresas/:companyId/preview`
   - ou `/admin/visualizar-cliente/:companyId`
3. dentro dessa área, o admin enxerga os mesmos módulos do cliente, com a identidade visual do portal de cliente, mas com um cabeçalho/banner claro indicando:
   - que está em modo administrativo;
   - qual empresa está sendo visualizada;
   - opção de voltar ao painel admin.

### Regra central

O modo preview deve sempre operar com um `companyId` explícito e validado. O backend não deve inferir o cliente a partir do admin logado, porque o admin pode visualizar qualquer empresa.

## 5. Arquitetura funcional proposta

```text
EmpresasAdmin
   └── ação "Visualizar portal"
         └── rota admin preview com companyId
               ├── PreviewLayout / ClientPreviewLayout
               ├── seletor ou cabeçalho da empresa atual
               └── mesmas páginas do cliente reaproveitadas

Frontend preview
   └── envia company_id no contexto das consultas

Backend client routes
   └── se admin + company_id explícito => filtra por essa empresa
   └── se cliente comum => usa user.company_id
   └── se admin sem company_id em endpoint de preview => rejeita ou mantém endpoint global apenas quando isso for intencional
```

## 6. Escopo recomendado da primeira entrega

### Incluído

- Botão/ação “Visualizar portal” na listagem de empresas.
- Nova rota de preview dentro do admin.
- Layout de preview com identificação clara da empresa.
- Reaproveitamento das páginas já existentes do cliente.
- Ajuste das consultas frontend para suportar o `companyId` do preview.
- Ajuste das rotas backend para aplicar filtro por empresa quando o usuário for admin em modo preview.
- Estados de carregamento, erro e empresa inexistente.
- Verificação de permissões e manutenção do isolamento de dados.

### Fora do escopo inicial

- Impersonação real de login do cliente.
- Alterar dados do cliente a partir do preview.
- Persistir histórico de “sessões de visualização” se isso ainda não existir.
- Duplicar todas as páginas de cliente em versões administrativas independentes.

## 7. Decisões de produto e UX

### 7.1. Acesso ao preview

O ponto de entrada principal deve ser a tabela de empresas no admin, pois é onde o operador já escolhe a organização com a qual quer trabalhar.

### 7.2. Sinalização visual

O preview precisa ter um aviso persistente, algo como:

> Visualizando como cliente: **Abraly** — modo administrativo

Isso evita confusão operacional e reduz o risco de o admin esquecer em qual contexto está.

### 7.3. Navegação

O ideal é preservar a navegação dos módulos do cliente dentro do preview, para que a validação seja fiel ao uso real. A diferença é que o cabeçalho administrativo e o botão “Voltar ao admin” devem continuar disponíveis.

### 7.4. Fidelidade

Sempre que possível, reutilizar as mesmas páginas e componentes do cliente. Quanto menos divergência entre “cliente real” e “preview admin”, menor o custo de manutenção e maior a confiança na inspeção.

## 8. Requisitos funcionais

1. O admin deve conseguir iniciar a visualização de uma empresa pela tela de empresas.
2. O preview deve carregar apenas dados da empresa selecionada.
3. O preview deve disponibilizar os mesmos módulos do portal do cliente.
4. O sistema deve deixar evidente qual empresa está sendo visualizada.
5. O admin deve conseguir retornar facilmente ao painel administrativo.
6. Se a empresa não existir ou estiver inacessível, o sistema deve exibir um estado apropriado.
7. O recurso não deve alterar a experiência do cliente comum.

## 9. Requisitos não funcionais

1. **Segurança:** nenhum dado de outra empresa pode aparecer no preview selecionado.
2. **Reuso:** priorizar o reaproveitamento de layouts, componentes e páginas já existentes.
3. **Manutenibilidade:** evitar forks desnecessários das telas de cliente.
4. **Clareza operacional:** o estado “modo preview” deve ser inequívoco.
5. **Compatibilidade:** clientes comuns devem continuar usando `/app` sem regressão.

## 10. Regras de autorização e dados

### Para cliente comum

- o backend continua usando `user.company_id` do JWT;
- qualquer tentativa de consultar outra empresa deve ser ignorada ou rejeitada.

### Para admin

- quando estiver em preview, o frontend envia `company_id` explícito;
- o backend valida que:
  - o usuário é admin;
  - a empresa existe;
  - o filtro é aplicado em todas as consultas pertinentes;
- endpoints de cliente usados em preview devem suportar escopo por empresa sem abrir brecha para consultas cruzadas acidentais.

## 11. Pontos técnicos provavelmente impactados

### Frontend

- `web/src/rotas/rotas.jsx`
- `web/src/pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`
- novo layout de preview dentro de `web/src/layouts/`
- possível novo contexto, hook ou utilitário para `companyId` do preview
- páginas em `web/src/pages/paginasClient/*`
- `web/src/services/api.js` ou camada de chamadas específicas, se for criado helper para anexar `company_id`

### Backend

- `backend/src/routes/client/dashboard-routes.ts`
- `backend/src/routes/client/metrics-routes.ts`
- `backend/src/routes/client/docs-routes.ts`
- `backend/src/routes/client/glpi-routes.ts`
- `backend/src/routes/client/network-routes.ts`
- eventuais serviços compartilhados, se algum endpoint ainda assumir implicitamente apenas o `user.company_id`

## 12. Estratégia de implementação recomendada

### Opção recomendada: preview por contexto explícito

Essa é a melhor abordagem para este projeto hoje:

- mantém a autenticação do admin;
- reaproveita as telas de cliente;
- evita login fictício/impersonação;
- torna o escopo auditável e previsível.

### Abordagens não recomendadas para a primeira versão

#### 1. Impersonação completa de usuário cliente

Mais complexa, com implicações de auditoria, troca de sessão e risco de confusão entre ações.

#### 2. Duplicar todas as telas do cliente dentro do admin

Resolve o problema rápido no começo, mas cria manutenção dobrada e divergência visual com o tempo.

## 13. Critérios de aceite

1. A tela de empresas possui uma ação de visualização para cada empresa.
2. Ao abrir a visualização, o admin vê claramente o nome da empresa em contexto.
3. Dashboard, MS365, Servidores, Rede, Documentação e Chamados exibem apenas dados da empresa selecionada.
4. O mesmo admin alternando entre duas empresas vê dados diferentes de acordo com a seleção.
5. Um cliente comum continua vendo somente sua própria empresa.
6. Nenhuma rota de preview permite vazar dados de outras empresas.
7. Existe navegação simples de retorno ao admin.
8. Testes manuais e automatizados cobrem o fluxo principal e os casos de erro.

## 14. Riscos e cuidados

### Risco 1 — preview admin usar endpoint global por engano

Mitigação: criar uma regra uniforme de resolução de escopo no backend e cobrir com testes.

### Risco 2 — telas de cliente terem chamadas embutidas demais

Mitigação: centralizar a leitura do `companyId` de preview em hook/contexto compartilhado, evitando espalhar lógica condicional pelas páginas.

### Risco 3 — confusão operacional do admin

Mitigação: banner persistente, nome da empresa visível e retorno claro ao admin.

### Risco 4 — inconsistência entre módulos

Mitigação: inventariar todos os endpoints usados pelas páginas de cliente antes de liberar o recurso.

## 15. Resultado esperado

Ao final, o admin terá uma visão fiel, segura e reutilizável do portal de cada empresa, sem precisar trocar de conta e sem perder o isolamento multi-tenant do sistema.
