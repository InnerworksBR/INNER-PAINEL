# Inner Network Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** entregar um coletor Windows SNMP instalável com vinculação por código e integração ao Portal Inner.

**Architecture:** coletor independente de Hyper-V, com HTTPS de saída, fila SQLite, credenciais DPAPI e configuração central por empresa/rede. Fastify/Supabase armazenam vínculo, configuração e dados. React oferece instalação, vinculação, credenciais, configuração e telemetria.

**Tech Stack:** C#/.NET Windows, biblioteca SNMP mantida com suporte v2c/v3, SQLite, Fastify/TypeScript, PostgreSQL/Supabase, React/Vitest.

**Spec:** `docs/superpowers/specs/2026-10-19-inner-network-agent-design.md`.

## Global Constraints

- Modelo de todos os agentes de implementação e revisão: `gpt-6-luna`, solicitado pelo usuário.
- Trabalhar no checkout atual, branch `codex/network-agent-snmp`; preservar mudanças preexistentes e não restaurar `monitoring/`.
- Não aplicar migrations ao banco remoto, instalar serviços nesta máquina, varrer a rede real, fazer deploy ou publicar artefatos externamente.
- Escrever testes comportamentais primeiro e registrar a falha antes de implementar; depois executar os testes relevantes.
- Somente o controlador despacha agentes. Workers não criam subagentes e não alteram arquivos de outros responsáveis.
- A vinculação é posterior à instalação; o usuário informa o código no painel e cadastra credenciais no painel.
- Windows x64, runtime incluído, URL da API embutida no pacote, serviço `InnerNetworkAgent`.
- Sessão de vinculação de 15 minutos, consulta a cada 5 segundos, segredo privado distinto do código humano.
- Polling de 60 segundos, redescoberta de 15 minutos, até 16 consultas concorrentes, timeout de 2 segundos, uma repetição, até 4 credenciais por rede e 4.096 IPs distintos por configuração.
- Limites de recursos do contrato efetivo Windows/API: 256 redes, 1.024 credenciais resolvidas, coleta entre 30 e 3.600 segundos e descoberta entre 60 e 86.400 segundos; configurações incompatíveis são recusadas antes de salvar, sem truncamento silencioso.
- Apenas redes salvas e habilitadas no painel são consultadas; nenhum pré-requisito de ping ou tentativa de comunidade padrão.
- Outbox de 100 MB ou 1.000 lotes; nenhuma credencial SNMP na fila, logs ou respostas administrativas de leitura.
- Os testes existentes do Hyper-V devem continuar passando; contratos públicos existentes permanecem compatíveis.
- Retenção bruta de 30 dias, estados atrasado após 3 minutos e sem dados após 10 minutos.
- Baseline backend em 2026-10-19: 43/45 testes passam; duas falhas preexistentes em `tests/account.test.ts` relacionadas à troca de senha. Não alterar esse fluxo neste trabalho.
- Baseline frontend: 7/11 testes passam; quatro falhas preexistentes em `Conta/conta.test.jsx`. Baseline Hyper-V: 22/22 testes passam.

## Contrato de integração entre tarefas

Todas as respostas e payloads usam `snake_case`. Datas em UTC ISO-8601; IDs do banco são UUIDs. Prefixo administrativo abaixo é `/api/admin/monitoring/companies/:companyId`.

```ts
type NetworkConfiguration = {
  version: number;
  enabled: boolean;
  collection_interval_seconds: number;
  discovery_interval_seconds: number;
  networks: Array<{
    id: string; cidr: string; enabled: boolean; snmp_port: number;
    network_scope_id?: string;
    excluded_ips: string[]; credential_ids: string[];
  }>;
};
type SnmpCredential = {
  id: string; name: string; version: '2c' | '3';
  community?: string; username?: string;
  security_level?: 'authNoPriv' | 'authPriv';
  auth_protocol?: 'SHA1' | 'SHA256'; auth_password?: string;
  privacy_protocol?: 'AES128'; privacy_password?: string; context_name?: string;
};
type NetworkMetricBatch = {
  sequence: number; collected_at: string;
  devices: Array<{
    network_id: string; device_uid: string; ip_address: string;
    device_name: string; device_type: string;
    observed_at: string; result: 'success' | 'partial' | 'timeout' | 'auth_error' | 'protocol_error';
    sys_object_id?: string | null; sys_description?: string | null; sys_contact?: string | null;
    uptime_seconds?: number | null; response_time_ms?: number | null;
    manufacturer?: string | null; model?: string | null; serial_number?: string | null;
    firmware_version?: string | null; location?: string | null; engine_id?: string | null;
    interfaces_observed?: boolean;
    interfaces: Array<{
      if_index: number; name: string; description?: string | null; mac_address?: string | null; if_type?: number | null;
      admin_status?: number | null; oper_status?: number | null; speed_bps?: number | null;
      in_octets?: string | null; out_octets?: string | null;
      in_errors?: string | null; out_errors?: string | null;
      in_discards?: string | null; out_discards?: string | null;
      in_bps?: number | null; out_bps?: number | null;
    }>;
  }>;
};
```

Contadores inteiros de 64 bits trafegam como strings decimais para não perder precisão em JavaScript. `interfaces_observed: false` preserva o último inventário de interfaces; `true` permite substituir inclusive por uma lista observada vazia. Pacotes antigos sem o campo continuam aceitos. As credenciais só acompanham a resposta de configuração ao coletor autenticado; nunca a leitura administrativa de configuração.

```text
POST /api/agent/v1/pairings
  body: {machine_id,hostname,agent_version,os_version,detected_networks:string[]}
  201: {pairing_id,user_code,device_secret,expires_at,poll_interval_seconds,verification_url}
POST /api/agent/v1/pairings/status
  body: {pairing_id,device_secret}
  200: {state:'pending'|'approved'|'completed'|'expired',company_name?:string}
POST [admin-prefix]/network-agents/claim
  body: {code}
  200: {hostname,company_id,state:'approved'}
POST /api/agent/v1/pairings/complete
  body: {pairing_id,device_secret,refresh_token_hash}
  200: {agent_id,company_id,access_token,expires_in}
POST /api/agent/v1/refresh
  Existing body/response. Network agents send optional replacement_refresh_token,
  generated and persisted before request, alongside old refresh_token.
  Retry of the same old/new pair succeeds after a lost response. Hyper-V remains compatible.
GET [admin-prefix]/network-agents
  200: array of {id,hostname,agent_version,status,last_heartbeat,detected_networks,device_count,
    discovery_state?,last_discovery_at?,last_collection_result?,pending_count?}
GET [admin-prefix]/network-agents/:agentId/config
  200: NetworkConfiguration
PUT [admin-prefix]/network-agents/:agentId/config
  body: NetworkConfiguration (new network may omit id)
  200: NetworkConfiguration (server assigns network IDs and version)
POST [admin-prefix]/network-agents/:agentId/revoke
  204
GET [admin-prefix]/network-scopes
  200: array of {id,name,created_at}, company-owned explicit physical scopes
POST [admin-prefix]/network-scopes
  body: {name}; 201: {id,name,created_at}
GET [admin-prefix]/snmp-credentials
  200: array of credential metadata (id,name,version,username,protocols; no passwords/community)
POST [admin-prefix]/snmp-credentials
  body: SnmpCredential without id; 201: metadata
PUT [admin-prefix]/snmp-credentials/:credentialId
  body: replacement complete credential; 200: metadata
DELETE [admin-prefix]/snmp-credentials/:credentialId
  204 (remove associations atomically)
GET /api/agent/v1/network/config
  200: NetworkConfiguration & {credentials:SnmpCredential[]}
POST /api/agent/v1/network/metrics
  body: NetworkMetricBatch; Idempotency-Key: <agent_id>-<sequence>
  202 or 200: {status:'accepted'|'duplicate',sequence}
POST /api/agent/v1/heartbeat
  Existing shape; additional optional fields: discovery_state,discovered_devices,last_discovery_at
GET /api/admin/monitoring/network-agent/download
  authenticated binary ZIP; 503 with actionable explanation if package not built
GET /api/client/network/devices
GET /api/client/network/stats
  avgUptime is null without measured availability. uptime_measured_count and
  uptime_coverage_percent describe coverage; no_response,offline,stale,no_data are separate.
GET /api/client/network/events
  At most 50 newest visible events; ID-based scope, unambiguous legacy fallback only.
GET /api/client/network/devices/:id/details
  Profile at root, source snapshot in telemetry; freshness applies to that snapshot.
GET /api/client/network/devices/:id/history
  Visible profile required; legacy name-only rows require an unambiguous device match.
```

The backend task may add small fields required for diagnosis, but must update this contract and its report before handing off. Authentication, atomicity, and tenant isolation cannot be relaxed.

### Task 1: Backend, migrations, ingestão e leituras

**Ownership:** `backend/` somente, excluindo `backend/src/services/glpi-service.ts`, `backend/src/services/monitoring-api-client.ts`, `backend/scripts/` e arquivos de ambiente preexistentes. O worker pode alterar rotas de rede, freshness, dashboard/NOC e scheduler para que compartilhem estados consistentes.

**Files:** criar `backend/migration_022_network_agent.sql` e `backend/migration_023_network_agent_retention_scopes.sql` (020 e 021 já existem); criar serviços focados `network-pairing-service.ts`, `network-config-service.ts`, `network-ingestion-service.ts`, `network-validation-service.ts`, `network-freshness-service.ts`; criar `routes/network-agent-routes.ts` e `routes/admin/network-monitoring-routes.ts`; registrar em `app.ts`; acrescentar testes `tests/network-*.test.ts`. Pode dividir mais arquivos para manter responsabilidades claras.

**Interfaces:** consome autenticação de portal/agente existente, Supabase e contrato acima. Produz todas as rotas para o coletor e painel, com funções SQL transacionais.

- [x] Escrever e executar testes vermelhos que validem fluxo de código, limite de tentativas, proteção de sessão, namespace Hyper-V/rede, payloads inválidos, CIDRs, segredos e freshness.

Exemplos de comportamentos obrigatórios:

```ts
assert.throws(() => validateNetworkConfiguration({networks:[{cidr:'10.0.0.0/8'}]}));
assert.throws(() => validateNetworkBatch({...validBatch,sequence:0}));
assert.equal(applyNetworkFreshness({last_poll_at:'2026-10-19T12:00:00Z'},
  new Date('2026-10-19T12:11:00Z')).telemetry_status, 'no_data');
assert.equal(JSON.stringify(await listCredentialMetadata(db, companyId)).includes('my-community'), false);
```

- [x] Implementar migration com tabelas/RLS/grants, vinculação atômica, credenciais cifradas e ingestão atômica, incluindo estado atual, amostras, perfis e eventos. Funções SECURITY DEFINER só podem ser chamadas por service_role; busca de registros deve filtrar empresa e tipo. Corrigir unicidade de `registered_agents` preservando RPC Hyper-V e asset keys antigos.
- [x] Implementar validação HTTP que rejeite tipos errados sem TypeError, limitação por IP e sessão, credenciais exigindo chave explícita e endpoint de configuração exclusivo de agente de rede. Rotas do cliente devem usar projeção segura sem campos legados sensíveis.
- [x] Implementar classificação de estados e consultas por IDs consistentes no painel, dashboard e NOC; ausência de telemetria não vira evidência de queda física.
- [x] Implementar download apenas de pacote local fixo `agent/artifacts/Inner.Network.Agent-win-x64.zip`; não aceitar caminho do usuário. Não devolver um pacote inexistente ou marcar pronto sem build.
- [x] Rodar `npm test` e `npx tsc --noEmit`. Registrar falhas preexistentes separadamente e testar todas as rotas novas por Fastify injection, inclusive 401/403/cross-tenant.
- [x] Revisar o próprio diff e criar commit apenas dos arquivos próprios. Relatório inclui rotas efetivas, migrations, testes vermelhos/verdes, limitações e qualquer ajuste ao contrato.

### Task 2: Coletor Windows real e pacote instalável

**Ownership:** `agent/` somente; preservar o comportamento existente do Hyper-V. O worker pode extrair componentes comuns somente quando necessário e comprovar regressão pelos testes antigos.

**Files:** criar `agent/Inner.Network.Agent/`, `agent/Inner.Network.Agent.Tests/` e `agent/Inner.Network.Agent.Setup/`; scripts `agent/build-network-agent.ps1`, `agent/install-network-agent.ps1`, `agent/network-agent-status.ps1`; criar `agent/NETWORK-AGENT.md`, preservando a documentação Hyper-V em edição concorrente. Colocar arquivos de build em `agent/artifacts/`, sem binários nos commits.

**Interfaces:** consome o contrato acima e as rotas já entregues na Task 1. Produz `Inner.Network.Agent.exe`, configuração com URL do backend embutida pelo build, instalador gráfico autônomo `InnerNetworkAgent-Setup.exe`, ZIP contendo instalador/status e serviço `InnerNetworkAgent`.

- [x] Ler o contrato real e relatório da Task 1. Escrever testes vermelhos de sessão de vínculo, repetição após resposta perdida, CIDRs, sem ping, erros SNMP, reboots/contadores e persistência da fila/configuração/identidade.

```csharp
Assert.Equal(0, ranges.ExpandDistinct(["192.168.10.0/24", "192.168.10.0/25"])
    .GroupBy(ip => ip).Count(group => group.Count() > 1));
Assert.Null(rates.Calculate(previousOctets: 1000, currentOctets: 10,
    elapsedSeconds: 60, restarted: true));
```

- [x] Usar biblioteca SNMP real com versão fixada e licença registrada, após conferir documentação primária. Testar v2c/v3 contra simulador UDP local; não escrever um cliente que retorne dados fictícios nem omitir v3 silenciosamente.
- [x] Implementar worker com vinculação recuperável, refresh de token, configuração/cache DPAPI, descoberta e polling independentes de envio, UUID persistente por equipamento, coleta padrão e fila SQLite limitada.
- [x] Enviar contadores 64-bit como strings. Timeout não pode fabricar métrica zero ou disponibilidade 100%. OID opcional ausente gera null/partial e não perda do inventário anterior.
- [x] Implementar instalação gráfica idempotente, com payload embutido, UAC, validação de caminhos, ACLs, runtime incluído e nenhuma edição manual de JSON. Mostrar/copiar o código de vínculo emitido pelo serviço e disponibilizar consulta posterior; se offline, instalar e informar estado de espera. Manter scripts como alternativa operacional. Não instalar serviço neste host durante desenvolvimento.
- [x] Implementar build com `-ApiBaseUrl` HTTPS obrigatório e caminho de pacote compatível com download da Task 1. O ZIP deve ser extraível e incluir instalador que funciona a partir do próprio pacote.
- [x] Rodar os testes novos e de Hyper-V, publicar self-contained win-x64, inspecionar conteúdo do ZIP e validar sintaxe PowerShell sem executar instalação. Relatório distingue simulador, testes locais e piloto real ainda não executado.
- [x] Commit apenas de fontes/scripts/docs/testes próprios; não incluir `bin/`, `obj/`, artefatos ou runtime. Entregar instruções de build e localização do ZIP gerado.

### Task 3: Vinculação, configuração e monitoramento no painel

**Ownership:** `web/` somente, excluindo `web/.env`. Manter alterações em componentes pequenos e seguir estilo existente; não redesenhar telas não relacionadas.

**Files:** criar `web/src/components/NetworkAgentIntegration.jsx` e testes; integrar ao modal de `pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`; ajustar `pages/paginasClient/Rede/rede.jsx` e `components/AssetDetailDrawer.jsx` para telemetria e interfaces; acrescentar testes de Rede.

**Interfaces:** consome as rotas da Task 1 e pacote da Task 2, conforme contrato. UI em português, sem segredos existentes em campos ou respostas de leitura.

- [x] Ler o contrato efetivo e escrever testes vermelhos para vinculação, erro de código, seleção de empresa, cadastro de credencial, CIDRs, estado sem configuração e alteração de escopo durante polling.

```jsx
render(<NetworkAgentIntegration companyId="company-a" />);
fireEvent.change(screen.getByLabelText(/código de vinculação/i), {target:{value:'ABCD-EFGH-JKLM'}});
fireEvent.click(screen.getByRole('button', {name:/vincular agente/i}));
expect(await screen.findByText(/agente vinculado/i)).toBeInTheDocument();
```

- [x] Criar download autenticado, código de vinculação, lista de coletores, status/último contato, pausar/revogar e configuração de redes e credenciais v2c/v3 no contexto da empresa. Campos com labels, mensagens acessíveis e estados de carregamento/erro.
- [x] Renderizar o componente dentro do formulário existente sem aninhar outro form; todos os botões de ações usam `type="button"`.
- [x] Melhorar a tela Rede com freshness, filtros e estados vazios corretos, polling de 30 segundos e limpeza/reinicialização ao mudar empresa. Atualizar estatísticas e detalhes de interface usando dados reais; sem valores fictícios.
- [x] Garantir que os componentes descartem respostas pendentes de uma empresa anterior e nunca mostrem credenciais de leitura salvas. Download 503 deve explicar necessidade de gerar o pacote, sem link quebrado silencioso.
- [x] Rodar `npm test`, `npm run build` e lint dos arquivos alterados. Commit somente dos arquivos próprios.

### Task 4: Integração final, revisão e evidências

**Ownership:** controlador coordena revisão independente GPT-6 Luna. As correções das tarefas voltam ao implementador responsável; os achados cruzados da revisão final são agrupados em um único worker de integração com responsabilidade explícita pelos arquivos de rede em agente, backend e drawer. Documentação de entrega em `docs/10-Agentes/` e evidências neste plano.

**Interfaces:** valida o contrato completo das Tasks 1–3.

- [x] Revisão independente de compliance e qualidade após cada tarefa, com foco em segurança e interoperabilidade. Corrigir achados importantes antes de considerar tarefa concluída.
- [x] Executar testes relevantes completos, TypeScript, build React, testes .NET de ambos os agentes e build final do pacote. Não tratar testes SQL textuais como execução real de PostgreSQL.
- [x] Se houver PostgreSQL local disponível, executar migration em banco isolado e testar vinculação/ingestão concorrentes. Caso indisponível, documentar explicitamente essa limitação e fornecer comando/runbook reproduzível para o piloto.
- [x] Verificar que secrets nunca trafegam em rotas de cliente, estado antigo não vira Online, token do portal não vale para agente e revogação funciona.
- [x] Criar guia de implantação com sequência de migration, configuração da chave, build com URL real, instalação, vinculação, diagnóstico, piloto e rollback. Não fazer deploy ou varredura real.
- [x] Revisão final ampla por GPT-6 Luna, checagem do diff e commits. Entrega com artefato e limitações reais; nenhuma afirmação de validação em equipamentos físicos sem evidência.

## Evidências de execução

### Backend — Task 1

- Commits: `61d9d89`, `b321295`, `f9c0024`. Revisão independente GPT-6 Luna concluída após duas rodadas de correção.
- Verificação do controlador: `npx tsx --test tests/network-routes.test.ts tests/network-validation.test.ts tests/agent-auth.test.ts tests/sync-scheduler.test.ts` — 25 testes passaram.
- Suíte completa registrada pelo implementador: 61 passaram; duas falhas preexistentes em `tests/account.test.ts` continuam relacionadas à reautenticação para troca de senha.
- `npx tsc --noEmit`: erros preexistentes em `document-creator-routes.ts`, `document-generator-service.ts` e arquivo de trabalho externo `monitoring-api-client.ts`; sem erro novo nos arquivos de rede.
- Migrations 022/023 e fixture `backend/tests/network-agent-migration.integration.sql` executadas em PostgreSQL 17 real, num container isolado sem rede, portas publicadas ou volumes do usuário. O controlador repetiu o fixture após a última correção: `DO`, saída 0.
- O laboratório verificou funções SQL de vínculo e repetição, coexistência Hyper-V, ingestão idempotente, configuração, substituição/remoção de credenciais, escopos físicos, rejeição entre empresas, privilégios e retenção. A disputa concorrente de código teve um único vencedor.
- Retenção bruta de 30 dias drena lotes com limite de 64 chamadas ou 45 segundos por execução horária e proteção contra sobreposição no processo. Nota menor de cobertura da revisão: os testes de drenagem/limite/sobreposição não cobrem todas as combinações de deadline real, abort e mensagem de backlog.

### Coletor Windows — Task 2

- Commits: `207d757`, `6d657be`, `74dae5d`. Revisão independente GPT-6 Luna aprovada após duas rodadas de correção.
- Verificação final do controlador: `dotnet test agent/Inner.Network.Agent.Tests/Inner.Network.Agent.Tests.csproj --no-build --no-restore -v minimal` — 58 passaram, zero falhas. O controlador também confirmou 22/22 testes Hyper-V; o implementador repetiu os 22 após a última alteração.
- SNMP UDP em loopback: v2c e v3, SHA-1/SHA-256, authNoPriv e authPriv com AES-128. Regressão do probe real e coordenador confirma preservação do UID e histórico de contadores na mudança de IP.
- Recuperação: conclusão de vínculo repetível, refresh concorrente, autorização perdida após JWT expirado e refresh com HTTP 401, configuração válida em cache durante HTTP 503, heartbeat independente, descoberta separada de polling e nenhum inventário fabricado para IP sem resposta.
- Lotes abaixo de 3.800.000 bytes; ACK exige estado e sequência corretos. Rejeições 400/413 registram apenas diagnóstico limitado e não bloqueiam os próximos lotes nem são tratadas como ACK.
- PowerShell: três scripts aceitos pelo parser, zero erros. Build self-contained win-x64 concluído com a URL HTTPS pública. O controlador confirmou os hashes dos artefatos dessa etapa; a integração final abaixo os substitui.
- Instalador: `agent/artifacts/InnerNetworkAgent-Setup.exe`, 99.674.457 bytes, SHA-256 `593D772865E00C76C2F5B44EF8461C1B0C5C2F9BABB1CD03264C101104BD5B1A`.
- ZIP: `agent/artifacts/Inner.Network.Agent-win-x64.zip`, 94.081.220 bytes, SHA-256 `A1DCB20426621405973E762804DFE1E4F060236EC55DE247AA121A76345E2609`. Contém instalador, guia, auxiliares e licença; payload embutido inclui executável do serviço, configuração e SQLite nativo.
- Nota menor da revisão: o fluxo completo do worker após refresh com HTTP 401 até um novo código é confirmado pela ordem do código; os testes cobrem lifecycle e coordenador separadamente.

### Interoperabilidade backend — Task 4

- Commits `bdc918e` e `0bc93be`: migrations 022–024, fixture JSON produzido pelo serializador C#, metadados opcionais, atualização de inventário com overrides manuais, vínculos de origem, visibilidade de histórico/eventos, paginação e estatísticas sem disponibilidade fabricada. Revisão GPT-6 Luna aprovada após uma rodada de correção.
- Verificação independente do controlador: `npx tsx --test tests/network-validation.test.ts tests/network-routes.test.ts` — 20/20 passaram.
- Roteiro `backend/tests/run-network-agent-pg-tests.ps1` executado pelo controlador: migrations 022–024 e fixture SQL passaram em banco novo `network_agent_fresh_20261019204838`, no container PostgreSQL isolado. Após a correção final, o controlador repetiu o roteiro em `network_agent_fresh_20261019205715`: fixture e teste de identidade com duas sessões concorrentes passaram. O bootstrap está marcado como exclusivo de testes.
- Suíte completa registrada pelo implementador: 67 passaram, duas falhas preexistentes de conta. TypeScript continua com os erros externos já registrados.
- Download Fastify autenticado do ZIP real: HTTP 200, `application/zip`, 94.081.220 bytes, SHA-256 igual ao pacote final Windows. Cópia local em `backend/artifacts/Inner.Network.Agent-win-x64.zip`, ignorada pelo Git.
- A identidade compartilhada é reavaliada após o lock de serial; evidências de engine ID conflitantes ficam separadas inclusive em observações iniciais concorrentes. CIDRs com bits de host são recusados, preservando o endereço de rede informado. O controlador repetiu os dez testes de validação: todos passaram.

### Interface — Task 3

- Commits `118facb`, `14a15d5` e `1c8b3ad`. Revisão GPT-6 Luna aprovada após duas rodadas: edição preserva UUID/escopo, pausa de rede preserva inventário, e um relógio local atualiza o contato e a descoberta sem limpar rascunhos nem refazer a configuração.
- Última verificação focada registrada pelo implementador: 14/14 testes de integração e detalhes passaram, incluindo avanço do relógio, preservação do rascunho, ausência de chamadas extras e limpeza dos timers. Build e lint dos arquivos alterados passaram.
- Suíte web completa executada pelo controlador em `14a15d5`: 23 aprovados e as quatro falhas preexistentes de Conta. O build mantém os avisos conhecidos de Browserslist e tamanho do bundle.
- Inspeção local desktop e celular (390 px): formulário de edição carrega CIDR, exclusões, credencial e escopo existentes; salvar porta/pausa atualiza a configuração sem disparar o formulário externo. Sem overflow horizontal. Detalhes mantêm o contador `9007199254741001`, taxa zero e rótulos em português.
- Uma execução do detector Impeccable encontrou apenas uma classe roxa preexistente na seção de servidores do drawer compartilhado; nenhuma alteração de estilo fora do escopo foi feita. O detector JSX não substituiu a inspeção no navegador.
- Prévia isolada com adapter em memória, sem login ou chamadas à API de produção. O controlador confirmou o texto histórico da descoberta após a correção final e restaurou o viewport.

### Integração final — concluída

A revisão ampla identificou cinco correções: cache de autorização após novo vínculo, histórico legado com nomes ambíguos, serial genérico como identidade, substituição física no mesmo IP e preservação de interfaces em coletas parciais. A correção `0f766c5` fechou os três primeiros itens. A correção `07575b0` fechou as duas lacunas restantes: identidade parcialmente contraditória/aliases legados e disponibilidade de interfaces após timeout. O revisor GPT-6 Luna confirmou ambos os residuais endereçados, sem novos achados Critical/High/Important no diff. Todos os cinco achados funcionais estão concluídos.

- Verificação independente final do controlador: 62/62 testes .NET de rede; 21/21 testes focados de API/validação; PostgreSQL 17 real com migrations 022–025, fixture e duas sessões concorrentes em banco novo `network_agent_fresh_20261020192105`. Saída 0. O implementador confirmou 22/22 testes Hyper-V após a última mudança.
- Web completa: 25/29 aprovados, quatro falhas preexistentes de Conta/Sidebar. A última suíte completa backend teve 68/70 aprovados, duas falhas preexistentes de conta. TypeScript mantém os erros externos já registrados; nenhum novo erro de rede. A correção residual alterou somente store C#, SQL e seus testes; frontend/rotas TypeScript permaneceram iguais.
- Novo instalador: 99.869.529 bytes, SHA-256 `269FDC05DA6D4F17EF3F8D533A84AF7AB4A22D7110DD156AE371583E70C6D8D9`. Novo ZIP: 94.463.641 bytes, SHA-256 `86E11E2C0F5BA77894830A3227CA9FFD912E2261581C2D6C45AAFAEC51D59931`. O controlador conferiu o EXE independente, EXE dentro do ZIP e cópia do ZIP em `backend/artifacts/`; hashes correspondem. Smoke local autenticado: HTTP 200, `application/zip` e hash/tamanho exatos.
- Inventário de interfaces preservado também em timeout; taxas antigas ocultas e aviso de última lista conhecida confirmados em prévia isolada com dados simulados. As evidências e hashes atuais estão em `docs/10-Agentes/NETWORK-AGENT-INTEGRATION-VALIDATION.md`; o guia operacional cobre a implantação e o piloto.
- Limites de cobertura menores permanecem explícitos: matriz completa de deadline/abort/backlog da retenção e fluxo completo de provisioning/pairing com resposta de configuração atrasada e waiter real no semáforo. Os guards de epoch foram confirmados em revisão de fonte; não se afirma cobertura completa desses cenários.

Decisão registrada pelo controlador: concluir as duas correções funcionais mínimas apesar do limite de rodadas da skill, para cumprir a implementação aprovada antes de entregar. Se essa decisão fosse desnecessária, seu custo seria tempo adicional de implementação/revisão e um diff maior; ela não autoriza produção ou ampliação de escopo.

Nenhuma migration remota, instalação de serviço, varredura da LAN ou implantação em produção foi executada neste trabalho. O piloto físico permanece necessário.
