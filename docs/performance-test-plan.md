# Plano de Teste de Performance — Monitoramento Descentralizado

## Escopo

Este documento define os testes de performance para o sistema de monitoramento
descentralizado (impl. 019), cobrindo:

- Coleta de metricas por agentes
- Processamento e armazenamento
- Visualizacao no dashboard
- Capacidade de APIs administrativas

## Metricas Alvo (NFR)

| Metrica | Target | Critico |
|---------|--------|---------|
| Latencia coleta → visualizacao | < 90s | Sim |
| Throughput API (POST /metrics/v2) | 1.000 req/min por empresa | Sim |
| Throughput API (GET /dashboard) | 500 req/min por empresa | Nao |
| CPU do Agente (idle) | < 2% | Sim |
| Memória do Agente | < 100 MB | Nao |
| Heartbeat: tempo para marcar offline | 10 min ± 30s | Sim |
| Latência DB (escrita metrics) | < 500 ms (p99) | Nao |

## Ferramentas

- **k6** (Grafana k6) — carga de APIs REST
- **PowerShell** — testes de agente
- **pg_stat_statements** — latência de banco (PostgreSQL)

---

## Teste 1: Carga Base — 10 Clientes Simulados

### Objetivo
Validar comportamento normal com multiplas empresas enviando metricas.

### Configuração

```javascript
// k6 script: load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  scenarios: {
    steady_load: {
      executor: 'constant-vus',
      vus: 10,
      duration: '10m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

export default function () {
  const payload = JSON.stringify({
    company_id: `company-${__VU % 10}`,
    hostname: `agent-${__VU}`,
    collected_at: new Date().toISOString(),
    host: {
      cpu_percent: Math.random() * 100,
      memory_percent: Math.random() * 100,
      disk_percent: Math.random() * 100,
    },
    virtual_machines: [],
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-Agent-ID': `agent-${__VU}`,
    'X-API-Key': 'test-api-key',
  };

  const res = http.post(
    'https://staging.api.inner.com/api/agent/metrics/v2',
    payload,
    { headers }
  );

  check(res, {
    'status is 200 or 202': (r) => r.status === 200 || r.status === 202,
  }) || errorRate.add(1);

  sleep(6); // 10 req/min por VU = ~1 req a cada 6s
}
```

### Execução

```bash
k6 run load-test.js --out influxdb=http://localhost:8086/k6
```

### Critérios de Pass/Fail

- Taxa de erro < 5%
- Latência p95 < 500ms
- Nenhum erro HTTP 5xx

---

## Teste 2: Stress — 100 Métricas/min por Cliente

### Objetivo
Validar capacidade maxima suportada por empresa.

### Configuração

```javascript
// k6 script: stress-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';

const errors = new Rate('errors');
const requests = new Counter('total_requests');

export const options = {
  scenarios: {
    burst: {
      executor: 'ramping-arrival-rate',
      rate: 100,        // 100 req/min
      period: '1m',
      timeUnit: '1m',
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    errors: ['rate<0.1'],
  },
};

export default function () {
  const payload = JSON.stringify({
    company_id: 'stress-test-company',
    hostname: `agent-${__VU}`,
    collected_at: new Date().toISOString(),
    host: {
      cpu_percent: Math.random() * 100,
      memory_percent: Math.random() * 100,
      disk_percent: Math.random() * 100,
    },
    virtual_machines: [],
  });

  const headers = {
    'Content-Type': 'application/json',
    'X-Agent-ID': `stress-agent-${__VU}`,
    'X-API-Key': 'stress-api-key',
  };

  const res = http.post(
    'https://staging.api.inner.com/api/agent/metrics/v2',
    payload,
    { headers }
  );

  requests.add(1);
  check(res, {
    'status is 2xx': (r) => r.status >= 200 && r.status < 300,
  }) || errors.add(1);

  sleep(60 / 100); // 100 req em 60s
}
```

### Execução

```bash
k6 run stress-test.js --out influxdb=http://localhost:8086/k6
```

### Critérios de Pass/Fail

- Taxa de erro < 10%
- Latência p99 < 1.000ms
- Throughput sustentado >= 100 req/min

---

## Teste 3: Latência E2E — Coleta até Visualização

### Objetivo
Medir o tempo total entre a coleta de metricas no agente e a
disponibilizacao no dashboard.

### Metodologia

1. No agente, registrar timestamp de envio (`t_send`)
2. Na API, registrar timestamp de recebimento (`t_received`)
3. No dashboard, registrar timestamp de exibição (`t_displayed`)
4. Latência E2E = `t_displayed - t_send`

### Script de medição (PowerShell)

```powershell
# E2E latency test
$apiUrl = "https://staging.api.inner.com/api/agent/metrics/v2"
$headers = @{
    "Content-Type" = "application/json"
    "X-Agent-ID"   = "latency-test-agent"
    "X-API-Key"    = "test-key"
}

$sendTime = Get-Date

$body = @{
    company_id  = "latency-test-company"
    hostname    = $env:COMPUTERNAME
    collected_at = (Get-Date).ToUniversalTime().ToString("o")
    host = @{
        cpu_percent    = 45.2
        memory_percent = 62.8
        disk_percent   = 71.5
    }
    virtual_machines = @()
} | ConvertTo-Json

Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $body

# Aguardar e consultar dashboard
Start-Sleep -Seconds 90

$metrics = Invoke-RestMethod `
    -Uri "https://staging.api.inner.com/api/client/dashboard/metrics?agent_id=latency-test-agent" `
    -Headers @{ "Authorization" = "Bearer $adminToken" }

$receiveTime = [DateTime]::Parse($metrics.data[0].received_at)
$displayTime = Get-Date

$latencyMs = ($displayTime - $sendTime).TotalMilliseconds
Write-Host "Latência E2E: $latencyMs ms"
```

### Critérios de Pass/Fail

- Latência E2E < 90.000ms (90s) — **NFR critico**

---

## Teste 4: CPU do Agente em Idle

### Objetivo
Validar que o agente consome menos de 2% CPU quando ocioso.

### Metodologia

```powershell
# Medir CPU do processo do agente em idle
$processName = "inner-agent"

# Primeira medição (warm-up)
$cpu1 = (Get-Process -Name $processName -ErrorAction SilentlyContinue |
    Measure-Object -Property CPU -Sum).Sum

Start-Sleep -Seconds 60

# Segunda medição
$cpu2 = (Get-Process -Name $processName -ErrorAction SilentlyContinue |
    Measure-Object -Property CPU -Sum).Sum

$cpuDelta = $cpu2 - $cpu1
$cpuPercent = ($cpuDelta / 60) / (Get-CimInstance Win32_Processor).MaxClockSpeed * 100

Write-Host "CPU do agente em 60s idle: $cpuPercent %"
```

### Critérios de Pass/Fail

- CPU < 2% durante periodo de 60s em idle

---

## Teste 5: Capacidade do Banco de Dados

### Objetivo
Validar que escritas em `agent_metrics` mantêm latência adequada
sob carga.

### Query de verificação

```sql
-- Latência de escrita (p99)
SELECT
  pg_stat_statements.query,
  calls,
  mean_exec_time,
  percentile_cont(0.99) WITHIN GROUP (ORDER BY total_exec_time / calls) as p99_exec_time
FROM pg_stat_statements
WHERE query LIKE '%agent_metrics%'
ORDER BY mean_exec_time DESC
LIMIT 10;
```

### Critérios de Pass/Fail

- p99 latência de escrita < 500ms

---

## Relatório de Resultados

Ao final dos testes, documentar:

```
## Resultado dos Testes de Performance

Data: YYYY-MM-DD
Ambiente: staging / produção
Versão do agente: x.y.z
Versão da API: x.y.z

| Teste          | Target    | Resultado | Pass/Fail |
|----------------|-----------|-----------|-----------|
| Latência E2E   | < 90s     | XXs       | PASS/FAIL |
| Throughput API | 1000/min  | XXX/min   | PASS/FAIL |
| CPU Agente     | < 2%      | X%        | PASS/FAIL |
| DB p99         | < 500ms   | XXXms     | PASS/FAIL |
| Taxa de erro   | < 5%      | X%        | PASS/FAIL |

### Incidentes
- [ ] Describe any bottlenecks, OOM, timeouts
```

---

## Agendamento Sugerido

| Fase | Quando | Responsável |
|------|--------|-------------|
| Teste 1 (Carga base) | Antes do release | DevOps |
| Teste 2 (Stress) | Antes do release | DevOps |
| Teste 3 (Latência E2E) | Apos deploy staging | QA |
| Teste 4 (CPU Agente) | Apos deploy em produção | DevOps |
| Teste 5 (DB) | Mensal | DBA |

## Referencias

- [k6 Documentation](https://k6.io/docs/)
- [PostgreSQL pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html)
- [PowerShell performance counters](https://docs.microsoft.com/powershell/scripting/samples/collecting-performance-information)
