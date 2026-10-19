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
- Apenas redes salvas e habilitadas no painel são consultadas; nenhum pré-requisito de ping ou tentativa de comunidade padrão.
- Outbox de 100 MB ou 1.000 lotes; nenhuma credencial SNMP na fila, logs ou respostas administrativas de leitura.
- Os testes existentes do Hyper-V devem continuar passando; contratos públicos existentes permanecem compatíveis.
- Retenção bruta de 30 dias, estados atrasado após 3 minutos e sem dados após 10 minutos.
- Baseline backend em 2026-10-19: 43/45 testes passam; duas falhas preexistentes em `tests/account.test.ts` relacionadas à troca de senha. Não alterar esse fluxo neste trabalho.

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
    sys_object_id?: string | null; sys_description?: string | null;
    uptime_seconds?: number | null; response_time_ms?: number | null;
    manufacturer?: string | null; model?: string | null; serial_number?: string | null;
    firmware_version?: string | null; location?: string | null; engine_id?: string | null;
    interfaces: Array<{
      if_index: number; name: string; description?: string | null; mac_address?: string | null;
      admin_status?: number | null; oper_status?: number | null; speed_bps?: number | null;
      in_octets?: string | null; out_octets?: string | null;
      in_errors?: string | null; out_errors?: string | null;
      in_discards?: string | null; out_discards?: string | null;
      in_bps?: number | null; out_bps?: number | null;
    }>;
  }>;
};
```

Contadores inteiros de 64 bits trafegam como strings decimais para não perder precisão em JavaScript. As credenciais só acompanham a resposta de configuração ao coletor autenticado; nunca a leitura administrativa de configuração.

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
  Existing body/response. Rotates pre-persisted refresh token after completion.
GET [admin-prefix]/network-agents
  200: array of {id,hostname,agent_version,status,last_heartbeat,detected_networks,device_count}
GET [admin-prefix]/network-agents/:agentId/config
  200: NetworkConfiguration
PUT [admin-prefix]/network-agents/:agentId/config
  body: NetworkConfiguration (new network may omit id)
  200: NetworkConfiguration (server assigns network IDs and version)
POST [admin-prefix]/network-agents/:agentId/revoke
  204
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
```

The backend task may add small fields required for diagnosis, but must update this contract and its report before handing off. Authentication, atomicity, and tenant isolation cannot be relaxed.

### Task 1: Backend, migrations, ingestão e leituras

**Ownership:** `backend/` somente, excluindo `backend/src/services/glpi-service.ts`, `backend/src/services/monitoring-api-client.ts`, `backend/scripts/` e arquivos de ambiente preexistentes. O worker pode alterar rotas de rede, freshness, dashboard/NOC e scheduler para que compartilhem estados consistentes.

**Files:** criar `backend/migration_020_network_agent.sql`; criar serviços focados `network-pairing-service.ts`, `network-config-service.ts`, `network-ingestion-service.ts`, `network-validation-service.ts`, `network-freshness-service.ts`; criar `routes/network-agent-routes.ts` e `routes/admin/network-monitoring-routes.ts`; registrar em `app.ts`; acrescentar testes `tests/network-*.test.ts`. Pode dividir mais arquivos para manter responsabilidades claras.

**Interfaces:** consome autenticação de portal/agente existente, Supabase e contrato acima. Produz todas as rotas para o coletor e painel, com funções SQL transacionais.

- [ ] Escrever e executar testes vermelhos que validem fluxo de código, limite de tentativas, proteção de sessão, namespace Hyper-V/rede, payloads inválidos, CIDRs, segredos e freshness.

Exemplos de comportamentos obrigatórios:

```ts
assert.throws(() => validateNetworkConfiguration({networks:[{cidr:'10.0.0.0/8'}]}));
assert.throws(() => validateNetworkBatch({...validBatch,sequence:0}));
assert.equal(applyNetworkFreshness({last_poll_at:'2026-10-19T12:00:00Z'},
  new Date('2026-10-19T12:11:00Z')).telemetry_status, 'no_data');
assert.equal(JSON.stringify(await listCredentialMetadata(db, companyId)).includes('my-community'), false);
```

- [ ] Implementar migration com tabelas/RLS/grants, vinculação atômica, credenciais cifradas e ingestão atômica, incluindo estado atual, amostras, perfis e eventos. Funções SECURITY DEFINER só podem ser chamadas por service_role; busca de registros deve filtrar empresa e tipo. Corrigir unicidade de `registered_agents` preservando RPC Hyper-V e asset keys antigos.
- [ ] Implementar validação HTTP que rejeite tipos errados sem TypeError, limitação por IP e sessão, credenciais exigindo chave explícita e endpoint de configuração exclusivo de agente de rede. Rotas do cliente devem usar projeção segura sem campos legados sensíveis.
- [ ] Implementar classificação de estados e consultas por IDs consistentes no painel, dashboard e NOC; ausência de telemetria não vira evidência de queda física.
- [ ] Implementar download apenas de pacote local fixo `agent/artifacts/Inner.Network.Agent-win-x64.zip`; não aceitar caminho do usuário. Não devolver um pacote inexistente ou marcar pronto sem build.
- [ ] Rodar `npm test` e `npx tsc --noEmit`. Registrar falhas preexistentes separadamente e testar todas as rotas novas por Fastify injection, inclusive 401/403/cross-tenant.
- [ ] Revisar o próprio diff e criar commit apenas dos arquivos próprios. Relatório inclui rotas efetivas, migrations, testes vermelhos/verdes, limitações e qualquer ajuste ao contrato.

### Task 2: Coletor Windows real e pacote instalável

**Ownership:** `agent/` somente; preservar o comportamento existente do Hyper-V. O worker pode extrair componentes comuns somente quando necessário e comprovar regressão pelos testes antigos.

**Files:** criar `agent/Inner.Network.Agent/` e `agent/Inner.Network.Agent.Tests/`; scripts `agent/build-network-agent.ps1`, `agent/install-network-agent.ps1`, `agent/network-agent-status.ps1`; atualizar `agent/README.md` ou criar `agent/NETWORK-AGENT.md`. Colocar arquivos de build em `agent/artifacts/`, sem binários nos commits.

**Interfaces:** consome o contrato acima e as rotas já entregues na Task 1. Produz `Inner.Network.Agent.exe`, configuração com URL do backend embutida pelo build, ZIP contendo instalador/status e serviço `InnerNetworkAgent`.

- [ ] Ler o contrato real e relatório da Task 1. Escrever testes vermelhos de sessão de vínculo, repetição após resposta perdida, CIDRs, sem ping, erros SNMP, reboots/contadores e persistência da fila/configuração/identidade.

```csharp
Assert.Equal(0, ranges.ExpandDistinct(["192.168.10.0/24", "192.168.10.0/25"])
    .GroupBy(ip => ip).Count(group => group.Count() > 1));
Assert.Null(rates.Calculate(previousOctets: 1000, currentOctets: 10,
    elapsedSeconds: 60, restarted: true));
```

- [ ] Usar biblioteca SNMP real com versão fixada e licença registrada, após conferir documentação primária. Testar v2c/v3 contra simulador UDP local; não escrever um cliente que retorne dados fictícios nem omitir v3 silenciosamente.
- [ ] Implementar worker com vinculação recuperável, refresh de token, configuração/cache DPAPI, descoberta e polling independentes de envio, UUID persistente por equipamento, coleta padrão e fila SQLite limitada.
- [ ] Enviar contadores 64-bit como strings. Timeout não pode fabricar métrica zero ou disponibilidade 100%. OID opcional ausente gera null/partial e não perda do inventário anterior.
- [ ] Implementar instalação idempotente com validação de caminhos, ACLs, runtime incluído e nenhuma edição manual de JSON. Mostrar o código de vínculo do serviço e disponibilizar consulta posterior; se offline, instalar e informar estado de espera. Não instalar serviço neste host durante desenvolvimento.
- [ ] Implementar build com `-ApiBaseUrl` HTTPS obrigatório e caminho de pacote compatível com download da Task 1. O ZIP deve ser extraível e incluir instalador que funciona a partir do próprio pacote.
- [ ] Rodar os testes novos e de Hyper-V, publicar self-contained win-x64, inspecionar conteúdo do ZIP e validar sintaxe PowerShell sem executar instalação. Relatório distingue simulador, testes locais e piloto real ainda não executado.
- [ ] Commit apenas de fontes/scripts/docs/testes próprios; não incluir `bin/`, `obj/`, artefatos ou runtime. Entregar instruções de build e localização do ZIP gerado.

### Task 3: Vinculação, configuração e monitoramento no painel

**Ownership:** `web/` somente, excluindo `web/.env`. Manter alterações em componentes pequenos e seguir estilo existente; não redesenhar telas não relacionadas.

**Files:** criar `web/src/components/NetworkAgentIntegration.jsx` e testes; integrar ao modal de `pages/paginasAdmin/empresasAdmin/empresasAdmin.jsx`; ajustar `pages/paginasClient/Rede/rede.jsx` e `components/AssetDetailDrawer.jsx` para telemetria e interfaces; acrescentar testes de Rede.

**Interfaces:** consome as rotas da Task 1 e pacote da Task 2, conforme contrato. UI em português, sem segredos existentes em campos ou respostas de leitura.

- [ ] Ler o contrato efetivo e escrever testes vermelhos para vinculação, erro de código, seleção de empresa, cadastro de credencial, CIDRs, estado sem configuração e alteração de escopo durante polling.

```jsx
render(<NetworkAgentIntegration companyId="company-a" />);
fireEvent.change(screen.getByLabelText(/código de vinculação/i), {target:{value:'ABCD-EFGH-JKLM'}});
fireEvent.click(screen.getByRole('button', {name:/vincular agente/i}));
expect(await screen.findByText(/agente vinculado/i)).toBeInTheDocument();
```

- [ ] Criar download autenticado, código de vinculação, lista de coletores, status/último contato, pausar/revogar e configuração de redes e credenciais v2c/v3 no contexto da empresa. Campos com labels, mensagens acessíveis e estados de carregamento/erro.
- [ ] Renderizar o componente dentro do formulário existente sem aninhar outro form; todos os botões de ações usam `type="button"`.
- [ ] Melhorar a tela Rede com freshness, filtros e estados vazios corretos, polling de 30 segundos e limpeza/reinicialização ao mudar empresa. Atualizar estatísticas e detalhes de interface usando dados reais; sem valores fictícios.
- [ ] Garantir que os componentes descartem respostas pendentes de uma empresa anterior e nunca mostrem credenciais de leitura salvas. Download 503 deve explicar necessidade de gerar o pacote, sem link quebrado silencioso.
- [ ] Rodar `npm test`, `npm run build` e lint dos arquivos alterados. Commit somente dos arquivos próprios.

### Task 4: Integração final, revisão e evidências

**Ownership:** controlador coordena revisão independente GPT-6 Luna; correções voltam ao implementador responsável. Documentação de entrega em `docs/10-Agentes/` e evidências neste plano.

**Interfaces:** valida o contrato completo das Tasks 1–3.

- [ ] Revisão independente de compliance e qualidade após cada tarefa, com foco em segurança e interoperabilidade. Corrigir achados importantes antes de considerar tarefa concluída.
- [ ] Executar testes relevantes completos, TypeScript, build React, testes .NET de ambos os agentes e build final do pacote. Não tratar testes SQL textuais como execução real de PostgreSQL.
- [ ] Se houver PostgreSQL local disponível, executar migration em banco isolado e testar vinculação/ingestão concorrentes. Caso indisponível, documentar explicitamente essa limitação e fornecer comando/runbook reproduzível para o piloto.
- [ ] Verificar que secrets nunca trafegam em rotas de cliente, estado antigo não vira Online, token do portal não vale para agente e revogação funciona.
- [ ] Criar guia de implantação com sequência de migration, configuração da chave, build com URL real, instalação, vinculação, diagnóstico, piloto e rollback. Não fazer deploy ou varredura real.
- [ ] Revisão final ampla por GPT-6 Luna, checagem do diff e commits. Entrega com artefato e limitações reais; nenhuma afirmação de validação em equipamentos físicos sem evidência.

## Evidências de execução

Este bloco será preenchido pelo controlador com comandos e resultados observados, separando baseline, testes de laboratório e verificações pendentes de ambiente real.
