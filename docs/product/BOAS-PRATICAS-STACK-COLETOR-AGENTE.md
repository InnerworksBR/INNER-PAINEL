# Stack de Coletor + Agente — Documento para Discussão de Boas Práticas

**Data:** 2026-08-24
**Status:** rascunho para revisão com outra IA
**Origem:** `docs/product/ANALISE-STACK-MONITORAMENTO.md`, `docs/product/DISCOVERY-monitoramento-descentralizado.md`, `docs/product/PRD.md` e código atual (`agente/`, `backend/src/services/snmp-collector-service.ts`, `backend/src/services/agent-metrics-service.ts`).

---

## 1. Contexto

O Inner Painel abandonou a integração direta com Zabbix e construiu uma stack própria de monitoramento, composta por dois componentes que se reportam ao backend:

1. **Agente de host/VM** — script PowerShell (`agente/inner-agent.ps1`) instalado em cada servidor Windows monitorado. Coleta CPU, memória, disco, uptime e VMs Hyper-V via WMI/Get-Counter/Get-VM e envia via HTTPS POST para o portal.
2. **Coletor SNMP** — execução disparada no backend (`backend/src/services/snmp-collector-service.ts`) que itera um range de IPs e, na versão atual, **chama um stub `snmpWalk()` que sempre retorna `null`** — os devices descobertos nunca chegam a `network_devices`.

O objetivo deste documento é listar **boas práticas a discutir** com outra IA antes de seguir investindo nessa stack (em vez de migrar para Telegraf + InfluxDB + Grafana, como sugere a análise interna).

---

## 2. Estado atual (resumo executivo)

| Componente | Estado | Evidência |
|---|---|---|
| Agente endpoint (PowerShell) | ⚠️ Coleta, mas com ressalvas (CPU dependente de `Get-Counter`, buffer offline em memória) | `agente/inner-agent.ps1` |
| Processamento backend das métricas | ✅ Upsert idempotente, gera eventos, atualiza asset_profiles | `agent-metrics-service.ts` |
| Coletor SNMP (backend) | ❌ Stub `snmpWalk()` retorna null; nenhum device chega ao portal | `snmp-collector-service.ts:169-179` |
| Descoberta/discovery automático | ❌ Não implementado | — |
| Lock entre réplicas do backend | ❌ Não evidenciado | — |
| Retry/backoff/jitter no servidor | ❌ Não evidenciado | — |
| Retenção e agregação | ❌ Não implementado | — |
| Logs estruturados com correlação | ❌ Console / `agent.log` texto livre | — |
| Cobertura de teste | ❌ Não há testes específicos para o coletor | — |

---

## 3. Perguntas em aberto para a outra IA

Antes de debater práticas, quero alinhar as **decisões** que essas práticas devem servir:

1. Faz sentido continuar investindo ~60–120h na stack custom, ou migrar para Telegraf + InfluxDB + Grafana (~28–48h)?
2. Onde a coleta deve rodar — no backend (HTTP) ou em um worker dedicado/coletor on-premise por cliente?
3. Como manter compatibilidade com o PRD (RF-020 a RF-029 sobre Zabbix, RF-030 a RF-036 cockpit, RNF-001 a RNF-010) sem dois caminhos de dados paralelos?
4. Qual é o SLA aceitável para o coletor SNMP (frescor, completude, falsos negativos)?
5. O cliente pode ver dados de configuração do SNMP/credenciais, ou apenas resultados?

---

## 4. Boas práticas a discutir — lado a lado

Para cada prática, listo: **(a)** o que a prática pede, **(b)** o que temos hoje, **(c)** o que ainda falta, **(d)** trade-offs / alternativas a considerar com a outra IA.

### 4.1 Coleta (agente de host/VM)

**(a) Prática esperada**
- Pull leve, idempotente, com buffer offline persistido em disco (não só em memória) e backpressure.
- Identidade por `asset_key` + segredo rotacionável; transporte HTTPS com mTLS opcional.
- Coleta em sandbox com privilégios mínimos (uma conta de serviço, não Administrator).
- Métricas rotuladas por feature/capability e por origem (`agent_native`, `snmp`, `wmi`).
- Versionamento do agente, capacidade de upgrade silencioso e rollback.

**(b) Estado atual**
- Script PowerShell com `Invoke-RestMethod`, intervalo mínimo 10 s, heartbeat a cada 300 s, buffer de 10 métricas em memória (perde no restart).
- Identidade via `asset_key` + `AgentSecret` em texto plano no `config.json` ou parâmetro.
- Roda como serviço via NSSM; precisa de privilégios elevados para Hyper-V.
- Payload com `idempotency_key` (GUID por envio) e `collected_at` ISO-8601.

**(c) Lacunas**
- Buffer offline **não sobrevive a reinício** (var `$Script:OfflineBuffer` no escopo do script).
- Não há persistência do buffer em disco nem limite de bytes (apenas contagem).
- Sem TLS reforçado, sem rotação de `AgentSecret`.
- Sem sandbox/permissões granulares — exige Admin (vide `agente/inner-agent.ps1:654`).
- Sem `agent_version` propagado para decisões de upgrade ou de contrato.
- CPU via `Get-Counter` está documentada como imprecisa em VMs (issue conhecido).
- Hyper-V CPU e disk são “placeholders” (`usage_percent = 0`).

**(d) Pontos a discutir**
- Manter PowerShell ou portar para um agente compilado (Go/Rust/.NET) — argumentos de manutenção, distribuição e bypass de ExecutionPolicy.
- Implementar buffer **em disco** (ex.: SQLite/LevelDB) com cap por tamanho e por idade.
- Validar uso de **Windows Service nativo** vs NSSM (NSSM é compatível, mas é dependência extra).
- Adotar autenticação por token JWT de curta duração obtido na fase de registro (`/api/agent/register`) e refresh em heartbeat — em vez de segredo estático.
- Métricas devem ser **inclui/exclui** por capability reportada, e o backend deve recusar features não habilitadas no cadastro do host.

### 4.2 Coleta SNMP (coletor de rede)

**(a) Prática esperada**
- SNMP v2c/v3 com timeouts por OID, retries com **jitter**, concorrência limitada por pool.
- **Cache de credenciais** (community) com carga lazy e segredo nunca em logs.
- Descoberta em **fases**: ping sweep → sysName/sysDescr → walk seletiva por classe de dispositivo.
- Persistência de OID por device para evitar refazer walk a cada ciclo.
- Reconciliação: marcar offline após N ciclos sem resposta; nunca “ressuscitar” host removido.
- Lock distribuído (Redis advisory lock ou pg_advisory_lock) por coletor para garantir **execução única entre réplicas** (RF-022).

**(b) Estado atual**
- Função `executeSnmpCollection` itera até 254 IPs sequencialmente, sem pool, sem timeout explícito.
- `snmpWalk()` é **stub** (`return null`).
- `community_string` é gravada em `snmp_collectors` e também copiada para `network_devices.snmp_community` (potencial vazamento).
- Reconciliação existe para mudança de status, mas não há tratamento para “ausência de resposta” vs “ativo removido”.
- Não há lock; se duas réplicas do backend rodarem, coletam em paralelo.

**(c) Lacunas**
- **Não há implementação SNMP real** — o coletor não descobre nem persiste nada hoje.
- Sem pool/timeout/retry/jitter no backend.
- Sem lock entre réplicas (RF-022 / CA-023).
- `snmp_community` em `network_devices` duplica segredo (prática ruim; segredo deve ficar só no coletor).
- Sem fallback SNMPv3 quando v2c falha.
- Geração de eventos: hoje compara `previousStatus` mas não considera staleness por idade do último poll.

**(d) Pontos a discutir**
- Definir **biblioteca** (candidatas: `net-snmp` via CLI, `node-net-snmp`, `snmp-native`/lib no child process) — lembrar que o backend é Node/TypeScript.
- Definir **intervalo mínimo** (RF-021) e o padrão de jitter; validar impacto em redes com muitos devices.
- Estratégia para **ranges grandes**: sharding por bloco /24, paralelismo controlado.
- Onde roda o coletor: no backend (acoplado a Postgres), em **worker on-premise por cliente** (atende o discovery de hosts não-Inner), ou híbrido?
- Persistir `snmp_community` criptografado (envelope encryption, previsto no RF-074) e **não replicar** para `network_devices`.
- Implementar **distância de poll** (último sucesso vs agora) e marcar `stale` antes de `down` (RF-023 / CA-021).
- Lock distribuído via Redis ou `pg_advisory_lock(hashtext('snmp:'||collector_id))`.

### 4.3 Recebimento no backend

**(a) Prática esperada**
- Endpoints `/register`, `/heartbeat`, `/metrics/v2` com **autenticação por token** e validação de contrato (zod/typia).
- **Idempotência**: dedupe por `idempotency_key` (já há boa base) e por janela de tempo.
- **Validação de payload** por versão (`schema_version`) para suportar migrações sem breaking change.
- Bounded queue: se o backend estiver sob carga, agente deve receber 429 com `Retry-After` (não acumular infinito).
- Logs estruturados (`pino`) com correlação (`request_id`, `agent_id`, `collector_id`).

**(b) Estado atual**
- `processAgentMetrics` faz dedupe por `idempotency_key` em `agent_metrics`.
- Falta contrato versionado do payload — qualquer mudança quebra o agente em campo.
- Falta 429 / backpressure explícito.
- `register` ainda grava `secret` (texto plano) em `registered_agents` — precisa hash + token de sessão.

**(c) Lacunas**
- Sem validação de schema; sem `schema_version`.
- Sem rate limiting nem 429.
- Sem request_id correlacionando agente → backend → banco → log.
- Sem circuit breaker / fila de ingestão.

**(d) Pontos a discutir**
- Adicionar `schema_version` e negociar (cliente envia, servidor aceita se igual à sua; senão responde `upgrade_required`).
- Definir **tamanho máximo de payload** por agente e coletor; recusar > limite com erro claro.
- Definir política de **autenticação**: token de longa duração vs sessão curta + refresh, e onde moram as chaves.
- Adotar `pino` com `requestId`, `agentId`, `companyId` em todos os logs.

### 4.4 Persistência e modelo de dados

**(a) Prática esperada**
- Separar **hot path** (status atual) de **cold path** (histórico) — escrita atual em `servers`/`network_devices`, histórico em `agent_metrics` com retenção.
- Retenção com **agregação**: manter raw por X dias, agregados horários por Y, diários por Z (RF-027 / CA-024).
- Soft delete + auditoria para qualquer mutação em `servers` / `network_devices`.
- Idempotência via `ON CONFLICT (company_id, hostname)` já presente — **bom** — replicar para devices.
- Sem armazenar segredos fora de tabela dedicada (RF-074).

**(b) Estado atual**
- Upsert por `(company_id, hostname)` para `servers`; nada equivalente para `network_devices` (hoje usa `device_name`).
- Histórico escrito em `agent_metrics` (sem retenção nem agregação).
- `snmp_community` espelhada em `network_devices` (deveria ficar só em `snmp_collectors`, criptografada).

**(c) Lacunas**
- Sem agregação horária/diária.
- Sem soft delete em `network_devices`/`servers`.
- Sem criptografia de segredos em repouso.
- Chave de upsert de `network_devices` é `device_name` — devices que mudam de nome vão criar duplicatas; melhor `(company_id, ip_address)` ou `(company_id, asset_key)`.

**(d) Pontos a discutir**
- Política de retenção: quanto tempo guardar raw e agregados? A outra IA deve sugerir números alinhados ao SLA.
- Criptografia de `community_string` (RF-074 já fala em envelope encryption; alinhar com o cofre).
- Trocar chave de upsert de `network_devices` para um identificador estável (sugiro `mac` se disponível, ou `ip + collector_id`).
- View materializada para o cockpit — pré-calcular criticidade, último poll, último sucesso, e expor via API com cache.

### 4.5 Concorrência, locks e execução única

**(a) Prática esperada**
- Cada coleta agendada deve ser **executada uma única vez** mesmo com N réplicas (RF-022 / CA-023).
- Lock distribuído com TTL curto (tempo da coleta + margem) e auto-renovação se a coleta demorar.
- Cancelamento cooperativo: ao receber SIGTERM, soltar o lock.

**(b) Estado atual**
- Não há lock; cada réplica executa em paralelo.

**(c) Lacunas**
- Sem coordenação alguma.

**(d) Pontos a discutir**
- Implementar lock em Postgres (`pg_try_advisory_lock` por chave `(scope, id)`) ou em Redis (`SET key NX EX`).
- Definir **granularidade**: por coletor SNMP e por empresa, ou global?
- Como integrar com BullMQ/pg-boss se houver fila de jobs no futuro?

### 4.6 Observabilidade e auditoria

**(a) Prática esperada**
- Logs estruturados (JSON), com `correlation_id`, `agent_id`, `collector_id`, `company_id`, `duration_ms`, `outcome`.
- Métricas internas: latência de ingestão, taxa de 2xx/4xx/5xx, tamanho médio de payload, devices_found, devices_failed.
- Eventos de domínio com severidade (`info|warning|critical`) e `freshness` (RNF-007).
- Auditoria separada: criação/alteração de coletores, revelação de segredo, mudanças de credenciais.

**(b) Estado atual**
- Logs do agente: texto livre em `agent.log`.
- Backend: console.log e `console.error` dispersos (ex.: `snmp-collector-service.ts:338`).
- Eventos de domínio existem (`monitoring-events-service`) mas com severidade fixa (`warning`/`info`).

**(c) Lacunas**
- Sem JSON estruturado nem correlação.
- Sem métricas de ingestão (Prometheus/OTel).
- Eventos sem `freshness` explícita; cockpit precisa dessa info (RF-028).

**(d) Pontos a discutir**
- Migrar logs para `pino` com `requestId` propagado.
- Expor `/metrics` Prometheus para ingestão, coleta, fila.
- Adicionar `freshness_seconds` aos eventos (tempo desde o último poll) e usar isso no cockpit.

### 4.7 Segurança

**(a) Prática esperada**
- Segredos (community SNMP, agent secret) **fora de logs, erros, payloads** (RNF-002).
- TLS obrigatório em produção; **mTLS** opcional para o agente.
- Rate limiting + respostas neutras (RF-082).
- Princípio de menor privilégio (RF-020: token de API de menor privilégio no Zabbix; replicar no SNMP — usar conta `read-only`).
- Revelação de segredo via step-up/MFA e auditoria (RF-072, RF-073).
- Versionamento de chave e rotação (RF-074).

**(b) Estado atual**
- `community_string` em texto plano em `snmp_collectors`.
- `secret` em texto plano em `registered_agents`.
- Sem rate limit nas rotas de agente.
- Sem TLS reforçado entre agente e portal documentado.

**(c) Lacunas**
- Criptografia de segredos em repouso (RF-074).
- Não persistir segredo fora da tabela de origem.
- Sem rotação.
- Sem auditoria de leitura de segredo.

**(d) Pontos a discutir**
- Adotar envelope encryption (KMS externo ou chave mestra fora do banco) já previsto no PRD.
- Definir política de **rotação automática** de `AgentSecret` (refresh em `/heartbeat` ou em tarefa agendada).
- Considerar **mTLS** ou, no mínimo, **token de longa duração + pinning** do portal.
- SNMPv3 com authPriv sempre que o device suportar; v2c apenas como fallback documentado.

### 4.8 Resiliência e degradação

**(a) Prática esperada**
- Falha na coleta **não deve bloquear** a leitura do último estado válido (RNF-006).
- `stale` antes de `down` (RF-023 / CA-021).
- Backoff exponencial + jitter entre tentativas do agente (RF-021 — já há no script, mas o backend não tem).
- Modo somente-leitura quando uma integração crítica quebra.

**(b) Estado atual**
- Agente: backoff/jitter para o cliente PowerShell (`Get-BackoffDelay`), mas é simples.
- Backend: sem backoff; falha de SNMP zera o ciclo.
- Cockpit pode mostrar “Online/Atenção” a partir de valor histórico (anti-pattern mencionado na análise interna — RF-023).

**(c) Lacunas**
- Backend sem retry/jitter entre coletas.
- Sem distinção entre **falha operacional** (device down) e **falha de coleta** (RF-034).
- Sem leitura resiliente do último valor válido.

**(d) Pontos a discutir**
- Implementar `freshness` por device e classificar UI em: **OK**, **Stale** (sem coleta em 2 ciclos), **Offline** (sem coleta em N ciclos).
- Definir thresholds por tipo de ativo (servidor, switch, AP) — alinhar com RF-035 (thresholds configuráveis).
- Para o agente: persistir o buffer offline **em disco** (seção 4.1) e limitar por idade (não só por contagem).

### 4.9 Configuração e deploy

**(a) Prática esperada**
- Config por **empresa** (multi-tenant) com escopo explícito.
- Credenciais e ranges via UI/admin com validação de contrato (RF-029).
- Versionamento de configuração; **dry-run** antes de aplicar.
- Feature flags para capability nova (ex.: habilitar SNMPv3 por empresa).

**(b) Estado atual**
- Tabela `snmp_collectors` com `company_id`, `enabled`, `interval_seconds`.
- Sem dry-run.
- Sem feature flag.

**(c) Lacunas**
- Sem teste de contrato no cadastro (RF-029).
- Sem visualização de cobertura por empresa (quantos hosts e devices deviam ser monitorados vs quantos estão).

**(d) Pontos a discutir**
- Criar endpoint `/api/admin/snmp_collectors/:id/diagnose` que executa um único ciclo sob demanda e mostra o que **deveria** ser descoberto vs o que foi (RF-029).
- Adicionar **cobertura esperada** por coletor (lista de IPs esperados, opcional) para o diagnóstico.

### 4.10 Testes e qualidade

**(a) Prática esperada**
- Testes unitários do coletor SNMP com fixtures (sysName/sysDescr sintéticos) cobrindo classes de dispositivo.
- Testes de integração em ambiente de homolog (GLPI + Zabbix + SNMP reais).
- Testes negativos multiempresa (RNF-001 / CA-041).
- Teste de carga: simulação de 1k, 10k devices e latência p95 < 2 s (RNF-004).
- Gate CI bloqueando merge (RF-001 / CA-001).

**(b) Estado atual**
- Sem testes específicos para o coletor SNMP (ver `snmp-collector-service.ts`).
- Agente tem `debug-agent.ps1` mas não é teste automatizado.

**(c) Lacunas**
- Sem testes unitários nem de contrato.
- Sem fixture SNMP.
- Sem teste de carga.

**(d) Pontos a discutir**
- Mínimo aceitável de testes antes de fechar a stack como “pronta para produção”.
- Adoção de **Mountebank** ou **snmpsim** para simulação local.
- Política de **gates** (typecheck/lint/test/build) — alinhar com RF-001.

---

## 5. Áreas onde a stack custom tem vantagem ou desvantagem

| Dimensão | Stack custom | Telegraf + InfluxDB + Grafana |
|---|---|---|
| Custo de entrada | Médio (já há código) | Baixo (POC) |
| Comunidade / suporte | Próprio | Grande |
| Integração com multi-tenant do portal | Natural | Requer sharding/tagging |
| SNMPv3 e credenciais | Sob nosso controle | Mais superfície de config |
| Lock entre réplicas | Implementar | Nativo se usar InfluxDB |
| Curva de manutenção | Alta | Média |
| Retenção e agregação | A construir | Maduro (InfluxDB) |
| Visualização/dashboards | Front já existente | Grafana (compartilhado) |

---

## 6. Recomendações para a conversa com a outra IA

1. **Trazer o PRD como âncora** — RF-020 a RF-029, RF-030 a RF-036, RNF-001 a RNF-007, CA-020 a CA-024. Tudo que propormos deve fechar um critério.
2. **Mostrar as evidências de código** — `agent-metrics-service.ts` já faz dedupe idempotente; `snmp-collector-service.ts:169-179` é o ponto de falha que vale ou não a pena fechar.
3. **Pedir à outra IA uma estimativa revisada** para fechar o coletor SNMP (com biblioteca, lock, retry/jitter, testes) — comparar com o esforço de migrar para Telegraf.
4. **Levantar 3 trade-offs** que precisamos decidir antes de codar:
   - Onde roda o coletor SNMP (backend vs worker on-prem por cliente).
   - Criptografia de segredos (KMS externo vs chave local) — alinhar com o cofre do RF-070+.
   - Identidade do agente (segredo estático vs token rotacionável).
5. **Não esquecer a operação**: instalação, upgrade, rollback, observabilidade. Se a stack custom não cobrir isso, a comparação com Telegraf muda de figura.

---

## 7. Próximos passos sugeridos

1. Rodar um POC **mínimo** do coletor SNMP usando `net-snmp` (CLI) em child process — medir tempo, identificar devices reais, validar o pipeline até `network_devices`.
2. Implementar lock distribuído por `collector_id` em Postgres (`pg_try_advisory_lock`).
3. Criptografar `community_string` e remover cópia em `network_devices`.
4. Adicionar `schema_version` ao payload do agente e do coletor.
5. Adicionar testes unitários do coletor com `snmpsim`.
6. Reavaliar após POC: ou seguimos investindo, ou definimos um plano de migração para Telegraf + InfluxDB + Grafana com custo de 28–48h estimado.