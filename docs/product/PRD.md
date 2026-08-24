# PRD — Portal Inner como cockpit moderno de gestão de TI

**Status:** aprovado  
**Data:** 2026-07-16  
**Aprovação:** Cristian, em 2026-07-16  
**Base factual:** `docs/project/repository-analysis.md`

## Problema, público e valor

O Portal Inner reúne dados de suporte e infraestrutura, mas ainda não oferece confiança operacional suficiente para ser o centro da gestão de TI. Indicadores usam janelas e denominadores inconsistentes, algumas informações exibidas não são realmente medidas, integrações não têm freshness/SLO e o baseline de qualidade permite comunicar como concluído algo que ainda falha em gates locais.

Públicos:

- **gestor do cliente:** quer uma visão simples, atual e auditável do ambiente e do atendimento;
- **analista Inner:** quer localizar rapidamente cliente, incidente, SLA e integração que exigem ação;
- **administrador Inner:** configura empresas, integrações, documentos, inventário, acessos e auditoria;
- **gestor Inner:** quer tendências, capacidade, risco, eficiência e qualidade de serviço entre clientes.

Valor esperado:

- reduzir tempo para detectar e priorizar problemas;
- eliminar indicadores enganosos ou sem fonte rastreável;
- reduzir trabalho manual de relatório, inventário e documentação;
- aumentar autonomia do cliente sem ampliar risco multiempresa;
- criar uma base segura para segredos operacionais.

## Objetivos

1. Transformar GLPI e Zabbix em fontes confiáveis, com período, freshness e rastreabilidade explícitos.
2. Criar um cockpit de plantão orientado a ação por cliente.
3. Entregar inventário GLPI consultável com garantia, idade e software.
4. Entregar o gerador Word já especificado na implementação 009.
5. Definir e, após reforço de segurança, entregar um cofre auditável.
6. Instituir gates que impeçam regressão entre comunicado, código e operação.

## Fora de escopo

- substituir GLPI, Zabbix, Microsoft 365 ou Supabase;
- executar deploy ou migration de produção sem aprovação específica;
- automação destrutiva em ativos/contas de clientes;
- pentest externo completo;
- cliente editar dados originados em GLPI/Zabbix nesta primeira fase;
- cofre exposto diretamente a usuários client no MVP;
- mobile nativo; o portal continua web responsivo.

## Jornadas

### Gestor do cliente

1. abre o dashboard e vê dados com horário, origem e estado de atualização;
2. entra em Chamados já no período de 30 dias;
3. entende quantos chamados têm SLA, quantos cumpriram, violaram ou estão em risco;
4. muda o período, inclusive para “Todo o histórico”, conscientemente;
5. exporta exatamente o conjunto filtrado;
6. consulta servidores, rede, inventário e documentos sem ver dados de outra empresa.

### Analista de plantão

1. abre o Cockpit;
2. vê clientes ordenados por criticidade;
3. distingue falha real, dado desatualizado e integração quebrada;
4. filtra por cliente, severidade, integração e responsável;
5. abre o contexto do ativo/chamado sem reconstruir manualmente a investigação.

### Administrador

1. cadastra uma integração e testa seu contrato;
2. acompanha última tentativa, último sucesso, duração, volume e erro sanitizado;
3. reconcilia inventário e decide o que é visível ao cliente;
4. gera/publica documentos Word;
5. acessa segredos apenas após reautenticação e com auditoria.

## Requisitos funcionais

### Fundação e release

- **RF-001:** O repositório deve ter um gate automatizado de typecheck, lint, testes, build e política de dependências antes de uma implementação ser marcada como concluída.
- **RF-002:** Status de implementação e critérios de aceite devem ser coerentes; não pode haver “Concluída” com critérios abertos ou gates falhando.
- **RF-003:** Migrations devem ser ordenadas, reproduzíveis e testadas em banco vazio; campos usados pelo código devem existir em migration versionada.
- **RF-004:** Cada tela operacional deve exibir estado de carregamento, vazio, erro e dado desatualizado.
- **RF-005:** Métricas devem expor período, última atualização e origem.

### GLPI e SLA

- **RF-010:** Chamados devem abrir por padrão em “Últimos 30 dias”.
- **RF-011:** O usuário deve poder escolher 7, 30 e 90 dias, intervalo customizado e “Todo o histórico”.
- **RF-012:** Lista, cards, SLA, categorias, requerentes e CSV devem usar exatamente o mesmo conjunto filtrado.
- **RF-013:** Filtros, busca, paginação e ordenação devem ser processados no backend.
- **RF-014:** Cada chamado deve exibir SLA como “Cumprido”, “Em risco”, “Violado” ou “Sem SLA”, com deadline quando disponível.
- **RF-015:** O percentual de SLA deve usar apenas chamados elegíveis e mostrar cobertura de SLA.
- **RF-016:** Campos brutos de SLA e resolução necessários à auditoria devem ser preservados com mapeamento versionado.
- **RF-017:** A sincronização deve ser incremental, idempotente e reconciliada periodicamente.
- **RF-018:** Falha no detalhe ao vivo não deve apagar o contexto já sincronizado; deve haver fallback/cache e erro claro.
- **RF-019:** O dashboard geral deve usar a mesma janela padrão de 30 dias para chamados.

### Zabbix, servidores e rede

- **RF-020:** A integração deve preferir API token de menor privilégio; sessão por usuário deve sempre executar logout em `finally`.
- **RF-021:** Cada coleta deve ter timeout, retry com backoff/jitter, limite de concorrência e lock contra sobreposição.
- **RF-022:** Uma execução deve ser única mesmo com múltiplas réplicas do backend.
- **RF-023:** Métrica antiga ou item não suportado deve virar “Desatualizado/Sem dados”, não Online/Atenção por valor histórico.
- **RF-024:** Mapeamento de CPU, memória, disco e disponibilidade deve ser configurável e validado por template/OS.
- **RF-025:** Uptime de rede deve ser calculado sobre janela declarada; ausência de histórico deve aparecer como “Sem dados”.
- **RF-026:** Hosts removidos/desabilitados devem ser reconciliados e não permanecer saudáveis no portal.
- **RF-027:** Histórico bruto deve ter retenção e agregações horárias/diárias para períodos longos.
- **RF-028:** Eventos devem registrar mudança, severidade, ativo, cliente, horário e freshness.
- **RF-029:** Diagnóstico da integração deve mostrar cobertura dos itens esperados sem revelar credenciais.

### Cockpit de plantão

- **RF-030:** O admin deve visualizar todos os clientes em uma única tela, ordenados por criticidade calculada.
- **RF-031:** Cada cliente deve mostrar servidores/rede críticos, SLA em risco/violado, integrações com erro e dados desatualizados.
- **RF-032:** O cockpit deve permitir filtros por cliente, severidade, origem e estado.
- **RF-033:** Cada alerta deve ter timestamp, origem, resumo, link de drill-down e estado de reconhecimento.
- **RF-034:** O sistema deve distinguir falha operacional de falha/atraso de coleta.
- **RF-035:** Criticidade e thresholds devem ser configuráveis sem alterar código.
- **RF-036:** O cockpit deve mostrar última execução, último sucesso e duração por integração.

### Inventário completo GLPI

- **RF-040:** Sincronizar computadores, monitores, impressoras e equipamentos de rede do GLPI.
- **RF-041:** Sincronizar instalações de software e permitir busca por software/versão/ativo.
- **RF-042:** Exibir fabricante, modelo, serial, patrimônio, status, local, usuário/responsável, compra e garantia quando disponíveis.
- **RF-043:** Calcular idade do parque e alertar garantia vencida/a vencer com thresholds configuráveis.
- **RF-044:** Suportar paginação, filtros, exportação e visão por empresa/tipo/status/idade.
- **RF-045:** Preservar overrides manuais e rastrear conflitos com a origem.
- **RF-046:** Reconciliar ativo removido, arquivado, duplicado ou transferido de entidade.
- **RF-047:** Cliente deve visualizar apenas ativos publicados e pertencentes à própria empresa.
- **RF-048:** O cockpit deve consumir alertas de garantia, idade e ausência de inventário.

### Gerador de Documentos Word

- **RF-060:** Manter como contrato a implementação 009 após validação do template oficial.
- **RF-061:** Gerar `.docx` a partir de conteúdo estruturado e permitir download ou publicação para a empresa escolhida.
- **RF-062:** Registrar geração/publicação em auditoria e impedir publicação duplicada por duplo clique.
- **RF-063:** Validar o arquivo gerado visualmente no Word antes de concluir a implementação.

### Cofre de credenciais

- **RF-070:** O MVP deve ser admin-only e exigir permissão granular por empresa e ação.
- **RF-071:** Listas devem retornar apenas metadados mascarados; o segredo só pode ser obtido em endpoint específico.
- **RF-072:** Revelar/copiar segredo deve exigir reautenticação/step-up e MFA.
- **RF-073:** Criar, alterar, revelar, copiar, excluir e recuperar devem gerar auditoria sem conter o segredo.
- **RF-074:** Segredos devem usar envelope encryption com key ID e rotação; chave mestra não pode ficar no banco.
- **RF-075:** Deve haver versionamento, soft delete e recuperação controlada.
- **RF-076:** A resposta de segredo não deve ser cacheada, logada ou enviada a analytics.
- **RF-077:** Deve haver tempo curto de revelação, mascaramento automático e limpeza de estado no frontend.
- **RF-078:** Testes negativos devem provar isolamento entre empresas, usuários e ações.
- **RF-079:** Break-glass e exportação devem ser políticas explícitas, desabilitadas por padrão no MVP.

### Correções transversais

- **RF-080:** Relatório HTML de Segurança deve ser sanitizado ou isolado/sandboxed sem acesso ao origin do portal.
- **RF-081:** Uploads devem validar tipo real, limitar consumo total e limpar arquivos órfãos em falha parcial.
- **RF-082:** Login deve ter rate limit e respostas neutras; produção não pode iniciar com CORS wildcard.
- **RF-083:** O portal deve adotar security headers e uma política de sessão compatível com o futuro cofre.
- **RF-084:** Status de integração GLPI deve usar `glpi_entity_id` e refletir a configuração realmente consumida pelo serviço.
- **RF-085:** MS365 não deve chamar licenças atribuídas de usuários ativos e deve remover SKUs obsoletos.
- **RF-086:** Saúde geral deve considerar contrato/módulo habilitado, freshness, disco, rede, SLA e integração sem misturar ausência esperada com falha.
- **RF-087:** Polling deve ser coordenado para evitar chamadas duplicadas por página/usuário.

## Requisitos não funcionais

- **RNF-001 — Isolamento:** toda consulta e mutação deve ter empresa resolvida no backend e testes negativos multiempresa.
- **RNF-002 — Segurança:** nenhum segredo, token ou conteúdo sensível em logs, erros, auditoria ou analytics.
- **RNF-003 — Freshness:** Zabbix deve indicar atraso em no máximo 2 ciclos esperados; GLPI em no máximo 2 ciclos de sync.
- **RNF-004 — Desempenho:** p95 de listagens cacheadas abaixo de 1 s para a carga acordada; cockpit abaixo de 2 s.
- **RNF-005 — Escala:** listagens paginadas; nenhuma rota client deve baixar histórico completo por padrão.
- **RNF-006 — Resiliência:** integração indisponível não deve bloquear leitura do último estado válido.
- **RNF-007 — Observabilidade:** sync deve registrar correlação, duração, tentativa, sucesso, volume e erro sanitizado.
- **RNF-008 — Compatibilidade:** mudanças não podem quebrar preview admin nem isolamento do cliente.
- **RNF-009 — Acessibilidade:** novos fluxos críticos devem operar por teclado, ter foco visível e mensagens anunciáveis.
- **RNF-010 — Retenção:** histórico bruto/agregado e auditoria devem ter políticas explícitas e aprovadas.

## Critérios de aceitação

- **CA-001:** CI bloqueia merge quando typecheck, lint, testes ou build falham.
- **CA-002:** índice e specs não indicam concluído enquanto houver critério aberto.
- **CA-010:** ao abrir Chamados sem parâmetros, API e UI retornam somente os últimos 30 dias.
- **CA-011:** selecionar “Todo o histórico” altera lista, cards, SLA e CSV de forma consistente.
- **CA-012:** chamados sem SLA não reduzem o percentual; cobertura é exibida separadamente.
- **CA-013:** amostra aprovada de chamados GLPI coincide com deadline/estado mostrado no GLPI.
- **CA-020:** nenhuma sessão Zabbix permanece aberta após sucesso ou erro de coleta por sessão.
- **CA-021:** item além do limite de freshness aparece “Desatualizado” e não alimenta saúde como atual.
- **CA-022:** uptime não aparece como 0% quando não há histórico suficiente.
- **CA-023:** duas instâncias do backend não executam o mesmo job simultaneamente.
- **CA-024:** retenção evita crescimento indefinido e gráficos longos usam agregados.
- **CA-030:** cockpit lista todos os clientes com os quatro sinais operacionais: ativos, SLA, integrações e freshness.
- **CA-031:** drill-down abre o cliente/ativo/chamado correto mantendo escopo.
- **CA-040:** inventário pesquisa ativo e software, calcula idade e alerta garantia.
- **CA-041:** ativo de empresa A nunca aparece para usuário da empresa B.
- **CA-060:** documento Word abre sem reparo e preserva template/cabeçalho/rodapé.
- **CA-070:** usuário sem permissão não obtém segredo nem por ID direto.
- **CA-071:** toda revelação/cópia gera auditoria e o valor secreto não aparece no log.
- **CA-072:** rotação de chave mantém leitura das versões autorizadas e registra migração.
- **CA-080:** HTML de Segurança não consegue ler `parent`, cookies, storage ou token do portal.
- **CA-081:** uploads inválidos/grandes são rejeitados sem arquivo órfão e sem pressão de memória não controlada.
- **CA-082:** audit de produção não mantém vulnerabilidade alta sem exceção aprovada e prazo.

## Métricas de sucesso

- 100% das telas operacionais com origem, período e freshness visíveis;
- 0 indicadores conhecidos com valor placeholder apresentado como medição;
- redução do tempo de triagem do plantão em pelo menos 50%;
- redução de 30–60 min por documento usando o gerador Word;
- 100% dos acessos a segredo auditados;
- 0 regressões multiempresa nos testes;
- 95% dos syncs dentro do SLO definido por integração;
- 100% das releases com gates verdes e critérios fechados.

## Prioridade proposta

1. **P0 — baseline e segurança:** gates, migration GLPI, iframe, dependências, sessão/timeout/lock Zabbix.
2. **P1 — dados confiáveis:** GLPI 30 dias/SLA, Zabbix freshness/uptime/retenção, MS365/status de integração.
3. **P1 — operação:** cockpit de plantão e observabilidade de sync.
4. **P2 — inventário GLPI.**
5. **P2 — gerador Word 009**, condicionado ao template.
6. **P3 — cofre**, condicionado a MFA, step-up, RBAC granular e desenho de chaves aprovados.

## Hipóteses registradas

- O período padrão de chamados será 30 dias corridos por `created_at`; filtros customizados podem usar data de criação nesta primeira entrega.
- “Todo o histórico” permanece disponível, mas nunca é o padrão.
- O SLA principal será TTR; TTO pode entrar em evolução posterior se não for exigência contratual imediata.
- O cockpit inicial é exclusivo para admins Inner.
- O cofre MVP não será visível para clientes.
- O inventário GLPI será read-only no portal.
- A versão instalada do GLPI será identificada antes do contrato técnico definitivo.

## Dependências e riscos

- acesso a uma instância/Swagger de homologação GLPI para validar campos e search options;
- acesso de homologação Zabbix ou fixtures realistas por versões suportadas;
- definição de SLO/freshness por integração;
- template Word oficial para a implementação 009;
- definição do provedor de chave/MFA para o cofre;
- aprovação específica para migrations, dependências, autenticação e qualquer ação em produção.

## Perguntas que não bloqueiam a aprovação do rumo, mas bloqueiam partes da execução

1. Quais versões de GLPI e Zabbix precisam ser suportadas?
2. SLA contratual é somente TTR ou também TTO?
3. Quantos clientes, hosts, dispositivos e tickets existem hoje e qual crescimento esperado?
4. Qual retenção desejada para histórico bruto, agregado e auditoria?
5. O cofre deve futuramente permitir acesso de cliente ou permanecer interno?
6. Qual serviço de chaves/MFA está disponível no ambiente de produção?

## Gate de aprovação

PRD aprovado explicitamente em 2026-07-16. A aprovação autoriza a criação da arquitetura e das implementações numeradas. Cada implementação ainda exige aprovação da própria especificação antes de alterar código, banco, dependências ou produção. Mudanças de escopo posteriores devem ser registradas no contrato correspondente.
