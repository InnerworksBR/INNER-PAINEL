# Inner Agent Hyper-V — Especificação de desenho

**Data:** 2026-09-28  
**Status:** aprovado em conversa; aguardando revisão escrita antes do plano de implementação  
**Escopo:** substituir o monitoramento operacional de servidores via Zabbix por um agente próprio instalado somente nos hosts Hyper-V.

## 1. Decisão principal

O Portal Inner terá um agente Windows próprio, executado como serviço no host Hyper-V de cada ambiente monitorado.

O agente será a fonte principal e única para o monitoramento de servidores. O Zabbix não será usado como fallback, fonte operacional, comparador ou dependência do novo fluxo. Dados antigos do Zabbix poderão permanecer arquivados apenas para consulta histórica, sem influenciar status, saúde ou métricas atuais.

O primeiro MVP não instalará agentes dentro das máquinas virtuais. O host Hyper-V descobrirá as VMs locais e enviará métricas disponíveis no nível do hypervisor. Métricas internas ao sistema operacional convidado, como espaço livre real dentro do volume, processos e serviços, ficam fora do MVP.

## 2. Objetivos e critérios de sucesso

### Objetivos

- Monitorar o host Hyper-V e suas VMs sem instalação individual.
- Atualizar o painel em aproximadamente tempo real.
- Continuar coletando durante indisponibilidade temporária da internet.
- Detectar automaticamente VMs novas, removidas, desligadas ou reiniciadas.
- Isolar dados por empresa e por agente.
- Permitir instalação, reinício e atualização do serviço sem perder a fila local.
- Manter o backend Fastify e o Supabase atuais como plataforma principal.

### Critérios de sucesso

- Um host instalado aparece no Portal com status e métricas.
- As VMs aparecem vinculadas ao host correto.
- Uma coleta normal chega ao painel em até 90 segundos no piloto.
- Repetir o mesmo lote não cria registros duplicados.
- Uma hora sem internet não perde os lotes ainda dentro do limite da outbox.
- Após a reconexão, os lotes pendentes são enviados sem intervenção manual.
- Reiniciar o host ou o serviço não perde credenciais nem dados pendentes.
- Uma VM nova aparece após a próxima descoberta.
- Uma empresa não consegue consultar dados de outra.
- O Zabbix não é chamado pelo scheduler nem é necessário para o status atual.

## 3. Arquitetura

```text
┌──────────────────────── Host Hyper-V ────────────────────────┐
│  Inner Agent Windows Service                                  │
│  ├─ Host collector                                            │
│  ├─ Hyper-V collector                                         │
│  ├─ SQLite outbox                                              │
│  ├─ Credential store (DPAPI)                                  │
│  └─ HTTPS transport                                            │
└───────────────────────────┬──────────────────────────────────┘
                            │ HTTPS
                            ▼
┌──────────────────── Portal Backend ───────────────────────────┐
│  Fastify                                                      │
│  ├─ Enrollment                                                │
│  ├─ Metrics ingestion                                         │
│  ├─ Heartbeat                                                 │
│  ├─ Current state + history                                   │
│  └─ Authenticated SSE                                         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
                    Supabase / PostgreSQL
                            │
                            ▼
                       Portal Web
```

### Componentes

#### Agente Windows

Será um Worker Service .NET publicado para Windows x64 e instalado como serviço. O processo terá módulos separados para:

- ciclo de coleta;
- descoberta Hyper-V;
- persistência da outbox;
- envio e retry;
- enrollment e renovação de credenciais;
- heartbeat;
- logging sanitizado.

O agente representa um único host físico. Ele não fará descoberta remota de outros hosts.

#### Backend atual

O Fastify atual receberá os endpoints de agente. Não haverá uma API de monitoring separada para este MVP, nem um banco PostgreSQL paralelo.

O código administrativo que hoje encaminha a criação de token para `MONITORING_API_URL` deverá ser substituído por uma operação nativa no backend atual.

#### Banco

As migrations existentes de agentes e métricas serão aproveitadas e corrigidas onde necessário. O estado atual do host e das VMs será normalizado em `servers`; o lote bruto da coleta será mantido em `agent_metrics`; eventos operacionais serão gravados em `monitoring_events`.

#### Painel

O painel fará uma leitura inicial do estado atual e abrirá uma conexão SSE autenticada para receber alterações. Se o SSE cair, o polling existente será usado como fallback para garantir convergência.

## 4. Coleta Hyper-V

### Host

O agente coletará:

- nome e identificador estável do host;
- versão do Windows;
- uso de CPU;
- uso e capacidade de memória;
- uso e capacidade dos discos locais monitorados;
- uptime;
- estado do serviço do agente;
- versão do agente;
- horário da última coleta.

### Máquinas virtuais

Para cada VM descoberta localmente, o agente enviará:

- identificador estável Hyper-V;
- nome;
- estado (`Running`, `Off`, `Paused` ou equivalente);
- CPU observada no hypervisor;
- memória atribuída e, quando disponível, memória utilizada;
- uptime da VM quando disponível;
- contadores de rede disponíveis;
- tamanho dos discos virtuais;
- horário da coleta.

O tamanho do VHD/VHDX não será tratado como espaço livre dentro do guest. Para obter espaço livre real, processos, serviços ou métricas específicas do sistema operacional, será necessário um agente adicional dentro da VM em uma fase futura.

### Descoberta e ciclo

- Intervalo inicial: 60 segundos.
- A lista de VMs será reavaliada a cada ciclo ou em uma frequência configurável.
- Cada lote conterá o host e todas as VMs conhecidas naquele ciclo.
- Uma VM desligada continuará identificada, mas seu estado será refletido como desligado e suas métricas poderão ser nulas.
- Uma VM removida será marcada como ausente/inativa após reconciliação, sem apagar imediatamente seu histórico.

## 5. Contrato da API

Todos os timestamps serão UTC. O `company_id` nunca será aceito como autoridade no payload do agente; será derivado do token de ativação ou da credencial do agente no servidor.

### Enrollment

```http
POST /api/agent/v1/enroll
Content-Type: application/json
```

```json
{
  "activation_token": "token-de-uso-unico",
  "hostname": "HV-01",
  "machine_id": "identificador-estavel-do-host",
  "agent_version": "1.0.0",
  "os_version": "Windows Server 2022",
  "hypervisor": "hyper-v"
}
```

Response:

```json
{
  "agent_id": "uuid",
  "access_token": "jwt-curto",
  "refresh_token": "token-rotacionavel",
  "collection_interval_seconds": 60
}
```

O token de ativação será de uso único e terá validade limitada. Após o enrollment, o agente removerá o token local de bootstrap.

### Métricas

```http
POST /api/agent/v1/metrics
Authorization: Bearer <access_token>
Idempotency-Key: <agent_id>-<sequence>
Content-Type: application/json
```

```json
{
  "sequence": 42,
  "collected_at": "2026-09-28T15:00:00Z",
  "host": {
    "hostname": "HV-01",
    "cpu_percent": 32.4,
    "memory_percent": 68.1,
    "memory_total_mb": 65536,
    "memory_used_mb": 44604,
    "disk_percent": 54.7,
    "uptime_seconds": 864000
  },
  "virtual_machines": [
    {
      "hyperv_id": "uuid-da-vm",
      "name": "VM-ERP",
      "state": "Running",
      "cpu_percent": 21.3,
      "memory_assigned_mb": 8192,
      "memory_used_mb": 6144,
      "uptime_seconds": 432000,
      "virtual_disk_size_gb": 120
    }
  ]
}
```

O backend responderá com confirmação do `sequence` aceito. A mesma chave de idempotência deverá retornar sucesso idempotente, sem inserir outro snapshot.

### Heartbeat

```http
POST /api/agent/v1/heartbeat
Authorization: Bearer <access_token>
Content-Type: application/json
```

O heartbeat informará versão, uptime do serviço, sequência criada, sequência confirmada, quantidade de lotes pendentes e o resultado da última coleta.

## 6. Modelo de dados

### `registered_agents`

Uma linha por host instalado. Deve conter empresa, identificador do agente, hostname, versão, hypervisor, status, último heartbeat e última métrica.

Segredos persistidos pelo backend devem ser armazenados de forma não reversível sempre que o fluxo não exigir recuperação. O agente armazenará seus tokens localmente protegidos por DPAPI.

### `servers`

O host será um servidor principal com `monitoring_source = 'agent_native'`. Cada VM será uma linha filha com:

- `agent_id`;
- `vm_parent_id`;
- `is_virtual = true`;
- identificador Hyper-V;
- status e métricas atuais;
- `last_updated` e timestamp da última coleta.

Será criada uma chave estável para evitar que renomear uma VM gere um novo ativo.

### `agent_metrics`

Armazenará o snapshot bruto recebido, incluindo o host e a lista de VMs. Cada registro terá sequência e chave de idempotência únicas por agente.

### `monitoring_events`

Eventos mínimos:

- agente registrado;
- agente atrasado/offline;
- falha de coleta;
- VM iniciada;
- VM desligada;
- VM descoberta;
- VM removida ou não encontrada na reconciliação.

O histórico bruto terá retenção configurável. O valor inicial recomendado para o MVP é 30 dias, com limpeza automatizada e possibilidade de ajuste posterior.

## 7. Resiliência e segurança

### Outbox local

O agente gravará cada lote em SQLite antes de tentar enviá-lo. O lote só será removido após ACK do backend.

- `2xx`: confirma e remove.
- `401`: renova a credencial uma vez e tenta novamente.
- `429`: respeita `Retry-After`.
- timeout, desconexão e `5xx`: backoff exponencial com jitter.
- `4xx` permanente: move para quarentena e registra diagnóstico.

A outbox terá limite de idade e tamanho. O agente não poderá ocupar o disco indefinidamente.

### Segurança

- HTTPS obrigatório.
- Token de ativação de uso único.
- Tokens permanentes protegidos por DPAPI LocalMachine e ACL restrita.
- Credenciais nunca expostas em logs.
- `company_id` derivado no backend.
- Limite de requisições por agente.
- Validação de versão, tamanho do payload e sequência.
- Separação entre autenticação de agente e autenticação de usuários do Portal.

### Freshness

Com intervalo padrão de 60 segundos:

- estado saudável: coleta recente;
- estado atrasado: aproximadamente 3 minutos sem métrica;
- estado offline: aproximadamente 10 minutos sem heartbeat ou coleta válida.

Esses limites serão configuráveis por ambiente, mas o painel sempre diferenciará `offline`, `stale` e `sem dados`.

## 8. Atualização em tempo real

Depois de confirmar a persistência de um lote, o backend emitirá eventos SSE para a empresa correspondente:

- `metrics_updated`;
- `agent_status_changed`;
- `vm_state_changed`;
- `monitoring_event_created`.

O cliente fará uma leitura inicial completa antes de assinar o stream. Ao reconectar, fará nova leitura do estado atual para recuperar eventos que ocorreram durante a queda.

O SSE não será considerado armazenamento durável. A fonte de verdade será o banco; o polling continua como fallback e mecanismo de convergência.

## 9. Testes e aceite

### Agente

- coletores com dados simulados;
- descoberta de VMs;
- VM ligada, desligada, pausada e reiniciada;
- persistência e leitura da outbox;
- retry por classe de resposta;
- expiração e renovação de token;
- reinício do serviço;
- limite de tamanho da fila.

### Backend

- enrollment com token válido, expirado, usado e inválido;
- isolamento por empresa;
- ingestão idempotente;
- sequência duplicada e fora de ordem;
- heartbeat sem nova métrica;
- transição de status online, atrasado e offline;
- reconciliação de VMs;
- SSE somente para a empresa autorizada.

### Aceite em host Hyper-V

- host com pelo menos duas VMs;
- criação de uma VM após instalação;
- desligamento e reinício de uma VM;
- perda de internet por uma hora;
- reboot do host;
- indisponibilidade temporária da API;
- validação visual do painel.

## 10. Implantação e rollback

### Sequência

1. Criar migrations aditivas para agentes, VMs e idempotência.
2. Implementar enrollment, ingestão e heartbeat no Fastify.
3. Implementar o serviço Windows e a outbox.
4. Atualizar as rotas de servidores e o painel para `agent_native`.
5. Adicionar SSE e fallback de polling.
6. Desabilitar o scheduler e os caminhos operacionais do Zabbix.
7. Instalar em um host Hyper-V interno.
8. Validar o piloto em uma empresa.
9. Expandir gradualmente.

### Rollback

O rollback não dependerá do Zabbix. Em caso de falha, será possível:

- desabilitar a ingestão do agente;
- manter o último estado conhecido visível como desatualizado;
- interromper ou reinstalar o serviço preservando a outbox;
- corrigir backend e retomar o envio posterior.

Dados históricos antigos do Zabbix, se existentes, permanecerão arquivados e não serão apagados como parte do MVP.

## 11. Fora do escopo do MVP

- instalação de agentes dentro das VMs;
- espaço livre interno do sistema operacional convidado;
- SNMP e descoberta de equipamentos de rede;
- comandos remotos;
- atualização automática assinada;
- suporte a VMware;
- monitoramento de aplicações, bancos ou serviços específicos;
- cluster Hyper-V com coleta distribuída entre vários hosts.

## 12. Riscos e decisões futuras

- Métricas internas das VMs exigirão agente guest ou integração adicional.
- Hosts Hyper-V em cluster podem exigir identificação e coleta específicas por nó.
- SSE em múltiplas réplicas precisará de um barramento compartilhado; até lá, polling de fallback garante convergência.
- Retenção e volume deverão ser revisados após medir a quantidade de hosts e VMs no piloto.
