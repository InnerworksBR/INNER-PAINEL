# Plano

## Estratégia

Implementar de fora para dentro: começar pelo backend (contratos de API), depois o agente PowerShell, então o coletor SNMP, e por fim a UI admin. Validação incremental com testes em cada fase.

**Ordem de precedência:**
1. Backend (API + Services) — base para tudo
2. Agente PowerShell — ferramenta de coleta do host
3. Coletor SNMP — ferramenta de coleta de rede
4. UI Admin — gestão dos componentes
5. Migração/Validação — archivar Zabbix, testar E2E

## Arquivos previstos

### Backend
```
backend/
├── src/
│   ├── routes/
│   │   ├── agent-routes.ts           # Endpoints do agente
│   │   ├── admin/
│   │   │   ├── agents-routes.ts      # CRUD agentes admin
│   │   │   └── snmp-routes.ts        # CRUD coletores admin
│   │   └── client/
│   │       └── dashboard-routes.ts    # Atualizado para agent_metrics
│   └── services/
│       ├── agent-metrics-service.ts  # Lógica de métricas
│       └── snmp-collector-service.ts # Lógica SNMP
└── migrations/
    └── 019_monitoring_agent_snmp.sql  # Tabelas novas
```

### Agente Windows
```
agente/
├── inner-agent.ps1                   # Script principal
├── config.example.json                # Exemplo de config
├── README.md                         # Instruções de install
└── tests/
    └── agent-test.ps1                 # Testes básicos
```

### Coletor SNMP
```
coletor-snmp/
├── src/
│   └── ColetorSNMP/
│       ├── Program.cs
│       ├── Services/
│       │   ├── SnmpClient.cs
│       │   ├── Discovery.cs
│       │   └── DeviceParser.cs
│       └── Models/
│           └── NetworkDevice.cs
├── ColetorSNMP.sln
└── README.md
```

### UI Admin
```
web/src/pages/
├── AgentesAdmin/
│   ├── AgentesLista.jsx
│   └── AgenteDetalhe.jsx
└── ColetoresSnmp/
    └── ColetoresLista.jsx
```

## Contratos de API

### POST /api/v1/agent/register
```json
Request:
{
  "hostname": "SRV-HOST-01",
  "ip_address": "192.168.1.10",
  "os_type": "Windows",
  "os_version": "Windows Server 2019",
  "hypervisor": "hyper-v",
  "agent_version": "1.0.0",
  "company_token": "uuid-da-empresa"
}

Response:
{
  "agent_id": "uuid",
  "api_key": "jwt-para-metricas"
}
```

### POST /api/v1/agent/metrics
```json
Request:
{
  "agent_id": "uuid",
  "idempotency_key": "uuid",
  "collected_at": "2026-08-01T10:00:00Z",
  "host": {
    "cpu_percent": 45.5,
    "memory_percent": 72.3,
    "memory_total_mb": 32768,
    "memory_used_mb": 23710,
    "disk_percent": 55.0,
    "disk_total_gb": 500.0,
    "disk_used_gb": 275.0
  },
  "virtual_machines": [
    {
      "name": "SRV-DB-01",
      "cpu_percent": 45.2,
      "memory_percent": 72.5,
      "memory_total_mb": 8192,
      "memory_used_mb": 5942,
      "disk_percent": 65.0,
      "status": "Running"
    }
  ],
  "partial": false
}

Response: 201 Created
```

### POST /api/v1/agent/heartbeat
```json
Request:
{
  "agent_id": "uuid",
  "status": "online",
  "metrics_pending": false
}

Response: 200 OK
```

## Sequência reversível

### Fase 1: Backend
1. Migration aditiva (tabelas novas)
2. Migration aditiva (campos em servers/network_devices)
3. Rotas agent + service
4. Rotas admin
5. Integração dashboard

### Fase 2: Agente
6. Script base com config
7. Coleta WMI
8. Hyper-V VM discovery
9. Retry/offline buffer
10. Testes e docs

### Fase 3: Coletor
11. Estrutura .NET/PS
12. SNMP client
13. Discovery
14. Device parsing
15. Serviço Windows

### Fase 4: UI + Migração
16. Páginas admin
17. Arquivar Zabbix
18. E2E + Validação

**Rollback:** Remover migrations, reverter imports, restaurar zabbix-service (arquivado)

## Testes e validações

### Unitários
- Parsing de métricas WMI
- Dedup por idempotency key
- SNMP OID parsing
- Device type inference

### Integração
- Registro de agente + metrics
- Heartbeat + offline detection
- SNMP discovery
- Multiempresa isolation

### E2E
- Instalação do agente em VM teste
- Coleta → Portal → Dashboard
- Deploy do coletor
- Discovery de 5 devices simulados

## Aprovações necessárias

- [ ] Spec aprovada (esta implementação)
- [ ] Migration aprovada antes de executar
- [ ] Scripts agente testados em homologação
- [ ] Coletor testado com dispositivos reais
- [ ] UI admin validada
- [ ] Arquivamento Zabbix aprovado
