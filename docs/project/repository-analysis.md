# Auditoria do Portal Inner

**Data da análise:** 2026-07-16  
**Escopo:** comunicado de atualização, funcionalidades atuais, integrações GLPI/Zabbix/Microsoft 365, segurança, desempenho, qualidade e viabilidade das funcionalidades anunciadas no horizonte.  
**Método:** inspeção estática do repositório, execução local dos gates disponíveis e consulta à documentação oficial das integrações. Nenhum serviço externo, banco de produção ou dado real foi acessado.

## Resumo executivo

O Portal Inner já possui uma base funcional relevante: autenticação, isolamento lógico por empresa, dashboards de cliente e admin, sincronizações GLPI/Zabbix/Microsoft 365, documentos, relatórios de segurança, inventário derivado do Zabbix e auditoria administrativa.

O comunicado, porém, está parcialmente acima do nível de confiança demonstrado pelo repositório. As melhorias visuais e os fluxos principais foram codificados, mas o baseline não está pronto para ser tratado como uma versão concluída:

- o backend não passa no TypeScript;
- o frontend tem 6 erros e 7 avisos de lint;
- 3 dos 5 testes de frontend falham;
- o frontend compila, mas gera um bundle JavaScript de 1,10 MB minificado;
- os audits de produção apontam vulnerabilidades altas com correção disponível;
- as implementações 003–008 aparecem como concluídas no índice, mas suas specs ainda dizem “Planejada” e mantêm critérios de aceite desmarcados;
- não existe CI para impedir que esse estado seja publicado novamente.

Os dois problemas operacionais mais importantes encontrados nas integrações são:

1. **GLPI:** a tela e as estatísticas retornam todo o histórico por padrão; o percentual de SLA inclui chamados sem SLA no denominador; o mapeamento do estado de SLA é simplificado demais; e a coluna `glpi_date_mod` usada pelo código não possui migration versionada.
2. **Zabbix:** a coleta abre sessões repetidamente e não executa `user.logout`; não há timeout, retry/backoff ou trava de concorrência; a validade temporal dos itens não é verificada; e o uptime de rede exibido no portal é sempre gravado como zero.

## Verificação do comunicado

| Item comunicado | Estado comprovado | Evidência | Lacuna ou risco |
|---|---|---|---|
| Aba Segurança por cliente | **Implementado, não pronto para release** | `migration_009.sql`, rotas admin/client e páginas de Segurança | O HTML é aberto em `iframe` sem `sandbox`, criando risco de script no mesmo origin; a página cliente também quebra o lint. |
| Recuperação de senha por e-mail | **Código presente, operação externa não comprovada** | `RecuperarSenha`, `RedefinirSenha`, rotas públicas e Supabase Auth | Não há teste automatizado; entrega de e-mail e redirect allowlist do Supabase dependem de configuração externa não verificada. |
| Minha Conta para admins | **Implementado com regressão de testes** | `/admin/conta`, `PUT /auth/me`, `POST /auth/change-password` | Os 12 testes do backend passam, mas 3 testes do componente Conta falham por drift entre teste e UI. |
| GLPI: CSV corrigido | **Implementado no frontend** | `chamados.jsx` gera BOM e linhas reais | Sem teste automatizado do arquivo; o módulo como um todo não passa no TypeScript. |
| GLPI: busca instantânea e limpar filtros | **Implementado** | `chamados.jsx` usa busca reativa, botão e chips | Filtragem é toda no browser após baixar todo o histórico; não escala. |
| GLPI: novas colunas de data | **Parcial e frágil** | UI e sync usam `glpi_date_mod` | Não há migration versionada para a coluna; em banco sem ajuste manual o sync falha no upsert. |
| Usuários: e-mail, busca e reset com confirmação | **Implementado** | API admin + `usuariosAdmin.jsx` | Sem testes do fluxo; há warning de hook na página. |
| Servidores: mobile, gráficos e eventos por servidor | **Implementado na UI** | `servidores.jsx` | A qualidade da informação de origem é comprometida pela coleta Zabbix; histórico não tem retenção. |
| Rede: busca, status e uptime | **Busca e status implementados; uptime não funcional** | `rede.jsx`; `zabbix-service.ts` | O backend grava `uptime_percent: 0` para todos os dispositivos. |
| Documentação: contadores e erros claros | **Implementado com ressalva** | `documentacao.jsx` | Contadores refletem a busca, mas também são afetados pela categoria ativa; uploads ainda têm riscos de memória/orfandade. |
| Painel admin polido | **Parcial** | telas e feedbacks presentes | `inventarioAdmin` tem 5 erros de lint; não há E2E/visual regression. |
| Menu lateral fixo | **Implementado** | sidebars usam `fixed` no mobile e `md:sticky` no desktop | Não foi executado teste manual em navegadores/dispositivos nesta auditoria. |
| Gerador Word | **Somente planejado** | `implementações/009-gerador-documentos-word` | Nenhum código/dependência existe; tarefa está bloqueada pelo template oficial `.docx`. |
| Cockpit de plantão | **Fundação parcial** | dashboard admin já lista integrações e eventos críticos | Não há visão por cliente, severidade operacional, SLA em risco, freshness ou drill-down unificado. |
| Inventário completo GLPI | **Não implementado** | GLPI atual sincroniza apenas tickets | `asset_profiles` só aceita `server` e `network_device`; não há computadores, monitores, impressoras, softwares, garantia ou idade. |
| Cofre de credenciais | **Não implementado e não deve usar o modelo atual sem reforços** | só há criptografia de secrets de integração | Faltam permissão granular, step-up, MFA, rotação de chaves, versionamento criptográfico e auditoria de leitura/revelação. |

## Como o sistema funciona hoje

### Autenticação e multiempresa

- O backend Fastify autentica no Supabase Auth e emite JWT próprio.
- Cada request autenticado recarrega `role`, `company_id` e `status` de `profiles`; isso impede que role ou empresa antigas sobrevivam apenas no token.
- Rotas client usam `resolveCompanyScope`: cliente recebe a própria empresa; admin pode enviar `company_id` para preview.
- O frontend guarda JWT em `localStorage` e o anexa como Bearer token.
- Há apenas dois papéis globais: `admin` e `client`; não existem permissões por módulo ou ação.

Pontos positivos: revogação de usuário/role está coberta por 12 testes de backend; secrets de Zabbix e Microsoft 365 são ocultados nas respostas administrativas e criptografados com AES-256-GCM.

Pontos a corrigir: login sem rate limit, CORS permissivo quando `FRONTEND_URL` falta, ausência de security headers, token exposto a XSS em `localStorage`, sem MFA/step-up e chave única de integração sem rotação/key ID.

### Dashboard do cliente

- Faz seis consultas paralelas ao Supabase via backend e agrega MS365, servidores, GLPI, documentos, rede e fichas de ativo.
- Só servidores e equipamentos marcados como visíveis entram nas áreas operacionais.
- A saúde geral considera CPU/memória/status de servidores e reduz toda a rede a no máximo um aviso.

Lacunas:

- GLPI usa todo o histórico no card;
- integrações desatualizadas ou com erro não entram na saúde;
- SLA não entra na saúde;
- disco não entra na classificação do servidor;
- ausência de servidor é tratada como “atenção”, mesmo quando o cliente não contratou o módulo;
- `activeUsers` do MS365 é preenchido com licenças atribuídas, que não representa usuários ativos.

### Microsoft 365

- Usa client credentials no Microsoft Graph.
- Sincroniza somente `/subscribedSkus` e persiste total, usado e disponível por SKU.
- Permite ao admin escolher as licenças usadas no dashboard.

Lacunas:

- não remove SKUs que deixaram de existir no tenant;
- não trata paginação Graph de forma genérica;
- não mede usuários ativos, SharePoint, MFA, Secure Score ou saúde de serviços, embora o README sugira um escopo maior;
- não há timeout/retry/backoff;
- o endpoint administrativo de “integração configurada” usa campos GLPI antigos e pode apresentar status incorreto.

### GLPI — tickets e SLA

Fluxo atual:

1. a cada 30 minutos, o scheduler inicia uma sessão GLPI global;
2. troca a entidade ativa para a empresa;
3. baixa até 5.000 tickets em páginas de 200;
4. mapeia status/prioridade/requerente/categoria/data/SLA;
5. faz upsert e remove do cache local tickets que não vieram na resposta;
6. a API client devolve todos os registros e calcula estatísticas em memória;
7. o frontend baixa tudo novamente a cada 2 minutos e filtra localmente.

Achados:

#### GLPI-01 — padrão de período incorreto (high)

`GET /api/client/glpi/tickets`, `GET /stats` e o dashboard não limitam período. A experiência padrão mostra o total histórico, contrariando a necessidade operacional de 30 dias e ampliando custo de rede/memória.

Correção de produto recomendada: preset padrão “Últimos 30 dias”, com “7 dias”, “90 dias”, intervalo customizado e “Todo o histórico” explícito. Tabela, cards, categorias, requerentes, CSV e SLA devem usar o mesmo filtro.

#### GLPI-02 — percentual de SLA matematicamente incorreto (high)

O código calcula `Dentro do SLA / total de tickets`. Tickets `N/A` entram no denominador. O indicador deve usar apenas tickets elegíveis a SLA, exibir a cobertura (`elegíveis / total`) e separar “em risco”, “violado”, “cumprido” e “sem SLA”.

#### GLPI-03 — interpretação frágil da origem (high)

Quando `sla_ttr_state` existe, qualquer valor diferente de `1` vira “Dentro do SLA”. Não há enum documentado nem persistência dos campos brutos necessários para auditoria (`slas_id_ttr`, `time_to_resolve`, `solvedate`, `closedate`, estado original). O fallback por datas também pode divergir do calendário/regras do próprio GLPI.

Recomendação: tratar o deadline calculado pelo GLPI como fonte de verdade, persistir campos brutos, versionar o mapeamento e validar amostra contra tickets reais de cada estado.

#### GLPI-04 — migration ausente (high)

O serviço envia `glpi_date_mod`, mas nenhuma migration cria essa coluna. A existência de um comentário no TypeScript não substitui migration reproduzível.

#### GLPI-05 — API sem paginação/filtros server-side (medium)

Lista, stats e dashboard carregam `select('*')`; o frontend filtra arrays completos. Deve haver contrato server-side único com período, busca, status, prioridade, categoria, paginação e ordenação.

#### GLPI-06 — sincronização cara e limitada (medium)

Todo ciclo relê até 5.000 tickets. A estratégia recomendada é sync incremental por `date_mod`, com backfill controlado e reconciliação periódica; a exibição de “todo histórico” não deve obrigar um full scan em cada ciclo.

#### GLPI-07 — detalhe depende da API externa em tempo real (medium)

Abrir um drawer cria nova sessão GLPI e busca tarefas/follow-ups. Falhas ou lentidão do GLPI quebram o detalhe mesmo com a listagem em cache. Faltam timeout, fallback e cache curto.

### Zabbix — servidores e rede

Fluxo atual:

- servidor: `host.get` para hosts, `item.get` para itens e heurísticas por `key_` para CPU/memória/disco;
- rede: novo login, outro `host.get` com todos os itens embutidos, classificação por nome/grupo e status por ping;
- scheduler executa servidor a cada 30 s e rede a cada 60 s, sequencialmente por empresa;
- cada coleta grava snapshot histórico, evento de mudança e ficha de ativo.

Achados:

#### ZBX-01 — sessões nunca são encerradas (high)

As duas rotinas de produção chamam `user.login`, mas não `user.logout`. Com ciclos de 30/60 segundos e múltiplas empresas, o Zabbix acumula sessões abertas. A própria documentação oficial exige logout quando se usa login por sessão. Melhor opção: API token com escopo mínimo; fallback por sessão sempre encerrado em `finally`.

#### ZBX-02 — uptime de rede é fictício (high)

`uptime_percent` é sempre salvo como `0`. O card e a coluna existem, mas não representam medição. O uptime deve ser calculado em janela definida (30 dias por padrão) a partir de histórico/eventos válidos, distinguindo “sem dados” de 0%.

#### ZBX-03 — dado antigo pode parecer atual (high)

`hasCollectedNumericValue` valida que `lastclock > 0`, mas não verifica idade máxima. Um item coletado há semanas pode manter servidor em “Atenção” e alimentar gráficos atuais. É necessário freshness por item conforme delay/threshold e estado “Sem dados/Desatualizado”.

#### ZBX-04 — seleção por heurística pode escolher métrica errada (medium)

CPU/memória/disco são escolhidos por primeira chave que “parece” correta. Ambientes com templates diferentes podem retornar um item incompatível. Deve existir perfil de mapeamento por template/OS/cliente, unidade/value type validada e diagnóstico de cobertura.

#### ZBX-05 — scheduler não é seguro para escala horizontal (high)

Os crons rodam dentro do processo web, sem lock distribuído, timeout ou proteção contra sobreposição. Uma execução lenta pode se sobrepor à próxima; duas réplicas duplicam toda a coleta e o histórico.

#### ZBX-06 — crescimento ilimitado do histórico (high)

Snapshots a cada 30/60 segundos são inseridos indefinidamente. Não há retenção, downsampling ou limpeza. Por servidor, isso representa aproximadamente 86.400 linhas/mês; rede adiciona 43.200 linhas/mês por dispositivo.

#### ZBX-07 — hosts removidos ficam no portal (medium)

Servidores e rede fazem upsert, mas não reconciliam registros que desapareceram/desativaram no Zabbix. Ativos antigos podem continuar visíveis e influenciar saúde.

#### ZBX-08 — polling duplicado (medium)

O README fala em Supabase Realtime, mas o hook é um wrapper de polling. Dashboard/MS365/Servidores e páginas GLPI/Rede fazem polling independente, ampliando chamadas quando vários usuários mantêm o portal aberto.

### Documentação e relatórios de segurança

Pontos positivos:

- bucket privado;
- URLs assinadas;
- escopo por empresa no download;
- substituição de relatório de segurança faz upload novo antes de apagar o antigo;
- falha de banco remove o arquivo novo.

Achados:

- **SEC-01 (high):** relatório Zero Trust HTML é reempacotado como `text/html` e exibido em iframe sem `sandbox`. Um script presente no relatório pode executar no origin do portal e acessar o JWT em `localStorage`. Usar renderização sem scripts, sanitização forte ou origem isolada.
- **SEC-02 (medium):** upload de documentos aceita MIME declarado pelo cliente e mantém até 10 arquivos de 50 MB em memória; o pior caso aproxima 500 MB por request.
- **SEC-03 (medium):** se um upload parcial ou insert em `documents` falhar, arquivos anteriores podem ficar órfãos.
- **SEC-04 (medium):** URL assinada dura 1 hora para documentos e 2 horas para relatórios; reduzir conforme uso e registrar acesso a conteúdo sensível.

### Inventário atual

O inventário administrativo não é inventário GLPI. Ele é uma camada de enriquecimento dos registros Zabbix `servers` e `network_devices`, com campos automáticos/manuais, visibilidade, revisão e inclusão na saúde.

Pontos positivos: preserva overrides manuais, registra auditoria e permite controlar o que o cliente vê.

Lacunas: sem paginação, busca pós-consulta, somente dois tipos de origem, sem ciclo de vida, garantia, idade, responsável, local, relacionamento, software, descoberta de duplicidade ou reconciliação GLPI.

### Admin, operação e observabilidade

- O dashboard admin agrega totais, cinco eventos críticos e cinco logs.
- O status de integração registra última tentativa, erro e quantidade.
- Não há cockpit por empresa, freshness/SLO, duração do sync, próxima execução, taxa de falha, fila, retry, correlação ou alerta.
- `hasAnyConfiguredIntegration` usa campos GLPI removidos; um GLPI configurado só por `glpi_entity_id` pode aparecer como não configurado.
- Erro e sucesso de sync usam o mesmo campo `last_sync_at`; não existe `last_success_at`, dificultando medir defasagem real.
- Não há métricas Prometheus/OpenTelemetry, tracing, health de dependências ou readiness; `/api/health` sempre responde `ok` sem verificar banco/integrações.

## Segurança do futuro cofre

O cofre não deve ser implementado apenas reaproveitando `encryptSecret` e a role `admin` atual.

Controles mínimos para um MVP seguro:

- permissão granular por usuário, empresa, pasta e ação (`listar metadados`, `revelar`, `copiar`, `editar`, `excluir`);
- conteúdo nunca retornado em listas;
- reautenticação/step-up antes de revelar ou copiar;
- MFA obrigatório para operadores do cofre;
- envelope encryption com key ID, rotação e recriptografia; chave mestra fora do banco;
- auditoria imutável de leitura, revelação, cópia, criação, alteração e exclusão, sem registrar o segredo;
- mascaramento por padrão e tempo curto de revelação;
- proteção contra cache, logs e analytics no endpoint de segredo;
- soft delete, versionamento e recuperação controlada;
- política de exportação e break-glass;
- testes de isolamento multiempresa e autorização negativa.

## Qualidade, testes, dependências e deploy

### Gates executados

| Comando | Resultado |
|---|---|
| `backend: npm test` | Passou: 12/12 testes |
| `backend: npx tsc --noEmit` | Falhou em `glpi-routes.ts`: `string | null` enviado a parâmetro `string` |
| `web: npm test` | Falhou: 3/5 testes de Conta |
| `web: npm run lint` | Falhou: 6 erros e 7 warnings |
| `web: npm run build` | Passou com chunk JS de 1.103,68 kB (319,69 kB gzip) |
| `backend: npm audit --omit=dev` | 2 vulnerabilidades altas (`form-data`, `ws`), correção disponível |
| `web: npm audit --omit=dev` | 4 vulnerabilidades altas (`form-data`, `ws`, `react-router`, `react-router-dom`), correção disponível |

### Cobertura existente

- Backend: apenas conta/autenticação/revogação.
- Frontend: apenas Conta, atualmente com drift.
- Sem testes de GLPI, Zabbix, MS365, documentos, Segurança, inventário, dashboards, multiempresa por endpoint ou E2E.
- Sem workflow CI, sem execução automática de migrations e sem evidência de smoke test de container.

### Schema e migrations

- `supabase_schema.sql` está defasado em relação às migrations e ao código.
- As migrations são SQL manuais, sem runner/ledger verificado no repositório.
- `migration_001` e `migration_003` repetem conceitos; não há prova automática de aplicar do zero.
- `glpi_date_mod` é usado sem migration.

## Priorização recomendada

### P0 — estabilizar antes de novas features

1. corrigir TypeScript, lint e testes;
2. versionar a migration GLPI ausente e criar teste de schema;
3. corrigir sandbox do relatório HTML;
4. corrigir vulnerabilidades altas;
5. adicionar CI com build, lint, typecheck, testes e audit policy;
6. adicionar timeout, encerramento de sessão e lock de sync.

### P1 — confiança operacional

1. GLPI 30 dias por padrão, filtros/paginação server-side e SLA auditável;
2. Zabbix freshness, uptime real, retenção/downsampling e reconciliação;
3. cockpit de plantão com integração/SLA/ativos por cliente;
4. corrigir semântica do MS365 e estado das integrações;
5. observabilidade de sync com `last_success_at`, duração e tentativas.

### P2 — expansão de produto

1. inventário completo GLPI;
2. gerador Word 009 após receber o template oficial;
3. cofre somente após reforço de identidade/permissões/chaves;
4. otimização de bundle, lazy loading e imagens.

## Limitações e desconhecidos

- Não foi acessado o Supabase remoto; não é possível afirmar quais migrations foram aplicadas em produção.
- Não foram usadas credenciais nem APIs reais de GLPI, Zabbix ou Microsoft Graph.
- Não foram validados entrega de e-mail e redirects do Supabase Auth.
- Não foram feitos testes visuais em navegador/dispositivo nem benchmark com carga real.
- Os campos/enum exatos de SLA devem ser validados contra a versão instalada do GLPI e seu Swagger/search options.
- A revisão de segurança foi não destrutiva; não prova ausência de outras vulnerabilidades.

## Referências externas consultadas

- Zabbix API atual: autenticação por API token ou sessão; sessão criada por `user.login` deve ser encerrada por `user.logout`.
- Zabbix `host.get`, `item.get`, History e Trends para metadados, valores atuais e séries temporais.
- GLPI REST API V1 usada pelo projeto e REST API V2/OAuth2 disponível em versões atuais.
- GLPI Service Levels: TTO/TTR e cálculo segundo calendário/regras do próprio GLPI.

