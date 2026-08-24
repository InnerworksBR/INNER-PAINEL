# Discovery

## 1. Resumo executivo

A implementação atual de Zabbix (013) é complexa, dependente de API externa e apresenta problemas de confiabilidade na coleta de dados. O plano é descontinuar essa abordagem e substituí-la por duas novas funcionalidades:

1. **Agente de Máquinas Virtuais e Hosts**: Um serviço stateless que executa em cada host/cliente, coletando métricas locais (CPU, memória, disco) e reportando ao portal via API.
2. **Coletor SNMP de Rede**: Um coletor que executa descobertas automáticas na rede via SNMP, monitorando switches, routers, firewalls e outros dispositivos de rede.

Esta mudança simplifica a arquitetura, elimina dependência direta da API Zabbix e permite coleta descentralizada com resiliência.

## 2. Problema

A implementação atual de Zabbix apresenta os seguintes problemas:

- **Acoplamento forte**: Todo fetch passa pela API Zabbix, criando ponto único de falha
- **Autenticação frágil**: Sessões por usuário exigem logout em `finally`, risco de sessões órfãs
- **Freshness inconsistente**: Métricas podem aparecer como "atualizadas" mesmo quando o Zabbix está desatualizado
- **Complexidade de mapeamento**: Templates Zabbix variam por cliente/OS, exigindo mapeamentos complexos
- **Escalabilidade**: Uma API central para múltiplos clientes cria gargalos
- **Custo operacional**: Manter integrações Zabbix atualizadas em todos os clientes é overhead

**Impacto no PRD:**
- RF-020 a RF-029 (Zabbix, servidores e rede) precisarão ser revisados
- Cockpit de plantão (RF-030 a RF-036) consumirá dados das novas fontes

## 3. Objetivos

1. **Descontinuar** a integração direta com API Zabbix para coleta de métricas
2. **Criar** um agente leve que colete métricas de servidores/VMs localmente e envie ao portal
3. **Criar** um coletor SNMP que descubra e monitore dispositivos de rede automaticamente
4. **Manter** compatibilidade com os dashboards e cockpit existentes
5. **Simplificar** a arquitetura eliminando o middleware Zabbix

## 4. Não objetivos

- Não suportar Zabbix ou outras APIs de monitoramento
- Não executar ações remotas em hosts
- Não coletar dados de aplicações específicas (banco de dados, etc.)
- Não suportar agente em Linux nesta versão (Windows only)
- Não criar sistema MDM completo
- Não suportar cloud (AWS EC2, Azure VM)

## 5. Usuários e atores

### Atores primários

| Ator | Descrição | Permissões |
|------|-----------|------------|
| **Admin Inner** | Configura agentes, credenciais SNMP, visualiza health | CRUD agentes, visualização completa |
| **Gestor Cliente** | Visualiza status de seus hosts e dispositivos | Visualização limitada aos ativos da empresa |
| **Host/VM** | Máquina monitorada com agente instalado | Passivo - apenas reporta dados |

### Fluxo de dados

```
┌──────────────────────────────────────────────────────────────┐
│  SERVIDOR HOST (Windows)                                     │
│  ┌──────────────┐   ┌────────────────┐                    │
│  │   AGENTE     │   │    COLETOR      │                    │
│  │  PowerShell  │   │  SNMP.exe      │                    │
│  │  (WMI/HyperV)│   │                │                    │
│  └──────┬───────┘   └───────┬────────┘                    │
│         │                    │                              │
│         └────────┬───────────┘                              │
│                  │ HTTPS POST                                │
└──────────────────┼──────────────────────────────────────────┘
                   │
                   ▼
        ┌─────────────────────────┐
        │      BACKEND PORTAL       │
        │  (Fastify + Supabase)    │
        └─────────────────────────┘
```

## 6. Fluxo principal

### 6.1 Agente de Host e VMs (Windows PowerShell)

1. Admin instala агент (PowerShell script ou .exe) no **servidor host** do cliente
2. Agente configura no primeiro実行 com:
   - URL do portal: `https://portal.inner.com.br`
   - Company Token: UUID fornecido pelo admin
3. Agente coleta métricas locais a cada **60s**:
   - **Host**: CPU, memória, disco (via WMI/Performance Counters)
   - **VMs**: Lista e métricas via Hyper-V ou VMware API
4. Agente envia POST para `/api/v1/agent/metrics` com:
   - Host: dados do servidor físico
   - VMs: array com nome, CPU, memória, disco
5. Backend valida token, armazena em `agent_metrics`
6. Heartbeat a cada **5min** para detecção de offline

### 6.2 Coletor SNMP de Rede (Windows)

1. Admin configura coletor via interface web admin:
   - IP range de descoberta
   - Community strings (v2c)
   - Intervalo de coleta (default 5min)
2. Coletor (exe/serviço Windows) executa:
   - **Discovery**: Varredura do range via SNMP GET
   - **Enumeração**: Coleta sysDescr, ifDescr, ifStatus
   - **Métricas**: Status de portas, uptime do device
3. Dispositivos suportados:
   - Switches (Intel, HP, Cisco, TP-Link)
   - Routers (MikroTik)
   - Antenas (Ubiquiti)
   - Impressoras de rede
   - Medidores de temperatura/sala (ambiente)
4. Dados são armazenados em `network_devices`

### 6.3 API Backend

| Endpoint | Método | Função |
|----------|--------|--------|
| `/api/v1/agent/register` | POST | Registrar агент (primeira execução) |
| `/api/v1/agent/metrics` | POST | Receber métricas do агент |
| `/api/v1/agent/heartbeat` | POST | Heartbeat do агент (a cada 5min) |
| `/api/v1/agent/vms` | POST | Enviar lista de VMs |
| `/api/v1/admin/agents` | GET/POST | Listar/cadastrar агент |
| `/api/v1/admin/agents/:id` | GET/PATCH/DELETE | Detalhe/update do агент |
| `/api/v1/admin/agents/:id/commands` | POST | Enviar comando ao агент |
| `/api/v1/admin/snmp/collectors` | GET/POST | Listar/cadastrar coletores SNMP |
| `/api/v1/admin/snmp/collectors/:id` | GET/PATCH/DELETE | Gerenciar coletor |
| `/api/v1/admin/snmp/discover` | POST | Disparar descoberta manual |
| `/api/v1/admin/snmp/status` | GET | Status dos coletores |

## 7. Fluxos alternativos e exceções

### Agente

| Cenário | Comportamento |
|---------|---------------|
| Host sem rede | Armazena métricas localmente, envia quando conexão disponível |
| Métricas incompletas | Envia o que conseguiu, marca `partial: true` |
| Autenticação falhou | Retenta com backoff exponencial (max 5min) |
| Timeout do endpoint | Buffer local, próximo ciclo tenta novamente |
| Host em sleep/hibernate | Agente detecta e suspende coleta |

### Coletor SNMP

| Cenário | Comportamento |
|---------|---------------|
| Device não responde SNMP | Marca como `unreachable`, mantém último estado válido |
| Community string inválida | Log de erro, não bloqueia outros devices |
| Device discovered em range | Upsert, não duplica |
| Rate limit na API | Fila com backoff, max 100 devices/min |
| Range muito grande | Paginação, max 254 IPs por range |

## 8. Regras de negócio

1. **RB-01**: Um host só pode reportar para uma empresa (identificado pelo token)
2. **RB-02**: Métricas com mais de 24h sem atualização são marcadas `stale: true`
3. **RB-03**: Coletor SNMP não pode executar mais de 1x simultaneamente por empresa
4. **RB-04**: Agente deve enviar heartbeat a cada 5min ou é considerado offline
5. **RB-05**: Credenciais SNMP são armazenadas no cofre (implementação 018)
6. **RB-06**: Discovery de rede não pode exceder 30min por execução
7. **RB-07**: Dados coletados são propriedade da empresa, retidos conforme política

## 9. Dados envolvidos

### Tabelas existentes a modificar

| Tabela | Mudança |
|--------|---------|
| `servers` | Adicionar `agent_id`, `agent_version`, `host_id` (vinculo com host), `vm_parent_id` |
| `network_devices` | Adicionar `snmp_collector_id`, `snmp_uptime`, `snmp_last_poll`, `snmp_sysdescr` |
| `monitoring_events` | Já suporta fonte `agent` e `snmp` |

### Tabelas novas

```sql
-- Agentes registrados (um por servidor host)
CREATE TABLE agent_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  hostname VARCHAR(255) NOT NULL,          -- Nome do servidor host
  ip_address INET,
  agent_version VARCHAR(50),
  os_type VARCHAR(50) DEFAULT 'Windows',
  os_version VARCHAR(100),                 -- ex: Windows Server 2019
  hypervisor VARCHAR(50),                  -- 'hyper-v' ou 'vmware'
  last_heartbeat_at TIMESTAMPTZ,
  last_metrics_at TIMESTAMPTZ,
  registered_at TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}',
  UNIQUE(company_id, hostname)
);

-- Métricas do agente (inclui host + VMs)
CREATE TABLE agent_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agent_registrations(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  -- Dados do host físico
  host_cpu_percent DECIMAL(5,2),
  host_memory_percent DECIMAL(5,2),
  host_memory_total_mb INTEGER,
  host_memory_used_mb INTEGER,
  host_disk_percent DECIMAL(5,2),
  host_disk_total_gb DECIMAL(10,2),
  host_disk_used_gb DECIMAL(10,2),
  -- VMs (JSONB para flexibilidade)
  virtual_machines JSONB DEFAULT '[]',
  -- Timestamps
  collected_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ DEFAULT NOW(),
  -- Integridade
  partial BOOLEAN DEFAULT false,
  idempotency_key VARCHAR(255) UNIQUE  -- Para evitar duplicatas
);

-- Colletores SNMP (um ou mais por empresa)
CREATE TABLE snmp_collectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id),
  name VARCHAR(255) NOT NULL,                    -- ex: "Rede Matriz"
  collector_host VARCHAR(255),                   -- IP do servidor com coletor
  ip_range_start INET,
  ip_range_end INET,
  community_string VARCHAR(255),                  -- Armazenar em produção (cofre)
  snmp_version VARCHAR(10) DEFAULT '2c',
  port INTEGER DEFAULT 161,
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMPTZ,
  last_devices_found INTEGER DEFAULT 0,
  last_status VARCHAR(50),                       -- 'success', 'partial', 'error'
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_id, name)
);

-- Índices para performance
CREATE INDEX idx_agent_metrics_agent_time ON agent_metrics(agent_id, collected_at DESC);
CREATE INDEX idx_agent_metrics_company_time ON agent_metrics(company_id, collected_at DESC);
CREATE INDEX idx_snmp_collectors_company ON snmp_collectors(company_id);
CREATE INDEX idx_servers_agent_id ON servers(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX idx_network_devices_collector ON network_devices(company_id, snmp_collector_id);
```

### Formato de `virtual_machines` (JSONB)

```json
[
  {
    "name": "SRV-DB-01",
    "cpu_percent": 45.2,
    "memory_percent": 72.5,
    "memory_total_mb": 8192,
    "memory_used_mb": 5942,
    "disk_percent": 65.0,
    "status": "Running"
  },
  {
    "name": "SRV-WEB-02",
    "cpu_percent": 23.1,
    "memory_percent": 48.0,
    "memory_total_mb": 4096,
    "memory_used_mb": 1966,
    "disk_percent": 40.0,
    "status": "Running"
  }
]
```

## 10. Integrações

### Integração com módulos existentes

| Módulo | Como consome dados |
|--------|-------------------|
| Dashboard `/summary` | Lê de `servers` (com agent_id) e `network_devices` |
| Cockpit de plantão | Lê `monitoring_events` com fonte `agent`/`snmp` |
| Inventário | Usa `agent_registrations` como fonte complementar |
| Auditoria | Todos os comandos de agente são auditados |

### APIs externas

| API | Uso |
|-----|-----|
| Nenhuma (SNMP é local) | Coletor SNMP é interno |
| Cofre (impl. 018) | Armazenar community strings SNMP |

## 11. Requisitos não funcionais

- **RNF-01**: Agente deve consumir < 2% CPU em idle (Windows)
- **RNF-02**: Latência de métrica (coleta → visualização) < 90s
- **RNF-03**: Coletor SNMP deve processar 254 IPs em < 5min
- **RNF-04**: Agente deve funcionar offline por até 1h (buffer local)
- **RNF-05**: API de métricas deve suportar 1000 POST/min por empresa
- **RNF-06**: Dados de агент retidos por 30 dias (bruto), 90 dias (agregados)
- **RNF-07**: Autenticação de агент via JWT com claim `company_id` e `agent_id`
- **RNF-08**: Coletor SNMP deve tolerar devices offline sem falhar
- **RNF-09**: Agente deve iniciar com Windows (serviço ou scheduled task)
- **RNF-10**: TLS 1.2+ obrigatório para todas as comunicações

## 12. Escopo do MVP

### Inclusão (MVP)

- [ ] **Agente PowerShell/EXE para Windows** (servidor host Hyper-V)
  - Coleta métricas do host físico
  - Detecta e coleta métricas das VMs (via Hyper-V WMI)
  - Instalador com configuração de URL + Company Token
- [ ] Endpoint POST `/api/v1/agent/metrics`
- [ ] Registro de agentes com heartbeat
- [ ] **Coletor SNMP Windows (.exe ou serviço)**
  - Discovery de range IP
  - Suporte SNMP v2c (fallback v1)
  - Suporte a: switches, routers, antenas, impressoras, medidores
- [ ] Armazenamento em `agent_metrics` e `snmp_collectors`
- [ ] Integração com dashboard existente (ler novas tabelas)
- [ ] Interface admin para gerenciar agentes e coletores
- [ ] Events para mudanças de estado

### Exclusão (MVP)

- [ ] ~~Agente Windows~~ → Agente **É Windows** (não é exclusão)
- [ ] ~~Agente Linux~~
- [ ] SNMP v3
- [ ] Comandos remotos ao agente
- [ ] Auto-update de agente
- [ ] Suporte a containers/Kubernetes
- [ ] Gráficos históricos no portal (agente)

## 13. Fora de escopo

- Monitoramento de aplicações (DB, web server, etc.)
- Alertas baseados em thresholds dinâmicos
- Auto-scaling ou actions baseadas em métricas
- Backup ou recovery de agentes
- Suporte a ambientes cloud (AWS EC2, Azure VM)
- Gerenciamento de configuração (CMDB)

## 14. Premissas

1. ✅ **Um servidor host por cliente** (Hyper-V ou VMware)
2. ✅ **VMs detectadas automaticamente** via Hyper-V API ou VMware tools
3. ✅ **Acesso total aos servidores** - metodogolia de install já estabelecida
4. ✅ **Rede local acessível** - sem NAT entre coletor e devices
5. ✅ **SNMP v2c predominante** em switches, antenas, impressoras
6. ✅ **Coletor executa em Windows** - servidor dedicado do cliente
7. ✅ **Zabbix descontinuado** - não há integração/convivência

## 15. Dependências

| Dependência | Status | Observação |
|-------------|--------|------------|
| ~~Implementação 018 (Cofre)~~ | **Desnecessária MVP** | Community strings podem ser texto inicialmente |
| Tabelas servers/network_devices | Existente | Adicionar campos de identificação |
| Scheduler (ADR-002) | Existente | Para coletor SNMP |
| Dashboard API | Existente | Ajustar para ler agentes |

## 16. Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Agente não instala por falta de permissões | Média | Alto | Documentar requisitos de sudo |
| Dispositivos SNMP bloqueiam coleta | Alta | Médio | Retry com backoff, marcar unreachable |
| Community strings vazam | Baixa | Crítico | Usar cofre, não armazenar em texto |
| Muitos agentes sobrecarregam API | Média | Médio | Rate limit por empresa |
| Latência alta em networks lentas | Média | Médio | Buffer local, compressão |

## 17. Decisões pendentes

| Decisão | Opções | Impacto |
|---------|--------|---------|
| D-01: Como distribuir агент? | Script inline vs apt/yum repo | Complexidade de deploy |
| D-02: Métricas de container/VMs? | Ignorar vs coletar | Volume de dados |
| D-03: Auto-update do агент? | Sim vs não | Manutenção vs segurança |
| D-04: Criptografia em trânsito? | TLS obrigatório vs opcional | Compatibilidade |

## 18. Critérios de sucesso

| Métrica | Baseline | Meta |
|---------|---------|------|
| Hosts com агент ativo | 0 | >80% dos servidores em 30 dias |
| Devices SNMP descobertos | Via Zabbix atual | Paridade ou superior |
| Latência coleta→visualização | N/A | < 90s (p95) |
| Eventos de rede gerados | Via Zabbix | Paridade |
| Incidentes por falha de coleta | N/A | < 1% por semana |
| Agentes offline > 1h | N/A | < 5% |

## 19. Perguntas em aberto

### BLOQUEANTES (respondidas)

1. **Q-01: Estratégia Zabbix** ✅ **Respondida:**
   - Zabbix sai **totalmente**. Migração completa.
   - Dados existentes do Zabbix serão arquivados, não migrados.

2. **Q-02: Volume por empresa** ✅ **Respondida:**
   - **1 servidor host** (Hyper-V/VMware) por cliente
   - **VMs**: 3 a 15 máquinas virtuais por host
   - **Rede**: depende do porte, mas inclui:
     - Antenas (Ubiquiti/MikroTik)
     - Impressoras de rede
     - Switches gerenciáveis
     - Medidores de temperatura/sala
     - Raramente routers/firewalls dedicados

3. **Q-03: Acesso aos servidores** ✅ **Respondida:**
   - Sim, temos **acesso total** aos servidores dos clientes
   - Somos responsáveis pela instalação e manutenção
   - Caution total - metodologia de deploy já estabelecida

4. **Q-05: Onde executa o coletor SNMP** ✅ **Respondida:**
   - Executa em **servidor Windows dedicado** do cliente
   - Pode ser o próprio host Hyper-V ou servidor separate
   - PowerShell/.exe native Windows

### IMPORTANTES (respondidas)

5. **Q-04: Versão SNMP** ✅ **Respondida:**
   - Foco em **SNMP v2c** (mais comum em dispositivos legados)
   - Suporte a v1 para dispositivos antigos

6. **Q-06: Retenção** ✅ **Decidido:**
   - Métricas brutas: 30 dias
   - Agregados horários: 90 dias
   - Events: 180 dias

---

## Status: READY FOR PRD

**Arquivo atualizado:** `docs/product/DISCOVERY-monitoramento-descentralizado.md`

**Principais decisões confirmadas:**
- ✅ Zabbix sai **totalmente** - descontinuação completa
- ✅ Agente **Windows** (PowerShell/EXE) no servidor host
- ✅ Host detecta **VMs automaticamente** (Hyper-V WMI)
- ✅ Coletor SNMP **Windows native** (exe/serviço)
- ✅ 1 host por cliente, 3-15 VMs, múltiplos devices de rede
- ✅ Acesso total aos servidores - metodologia de deploy estabelecida
- ✅ Retenção: 30d bruto, 90d agregado, 180d events

**Bloqueios restantes:** NENHUM - todas as perguntas bloqueantes respondidas

**Arquitetura simplificada:**
```
┌─────────────────────────────────────────────────────────────┐
│  SERVIDOR HOST (Windows)                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐   │
│  │   AGENTE    │  │   COLTOR    │  │    HYPER-V WMI   │   │
│  │  PowerShell │  │  SNMP.exe   │  │                  │   │
│  └──────┬──────┘  └──────┬──────┘  └────────┬─────────┘   │
│         │                │                   │              │
│         └────────────────┼───────────────────┘              │
│                          │                                  │
│                          ▼                                  │
│              ┌───────────────────────┐                     │
│              │    HTTPS POST          │                     │
│              │  /api/v1/agent/*       │                     │
│              └───────────┬───────────┘                     │
└──────────────────────────┼─────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     BACKEND PORTAL       │
              │  (Supabase + API)       │
              └─────────────────────────┘
```
