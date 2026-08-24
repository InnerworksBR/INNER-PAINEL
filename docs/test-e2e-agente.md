# Teste E2E - Agente de Monitoramento

## Objetivo
Validar o fluxo completo: instalacao do agente em servidor Windows -> envio de metricas -> visualizacao no portal.

## Pré-requisitos

- Servidor Windows com Hyper-V instalado (ou sem Hyper-V para testar apenas host)
- Acesso ao portal Inner em ambiente staging
- Token de empresa obtido via admin
- Postman ou curl para chamadas manuais
- Agente PowerShell implantado em `C:\Program Files\InnerAgent\`

## Ambiente de Teste

```
┌─────────────────────────────────────────────────────────────┐
│                      SERVIDOR TESTE                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ inner-agent  │  │  VM-WIN-SRV  │  │  VM-DEV-APP  │       │
│  │   (Host)     │──│  (Hyper-V)   │  │  (Hyper-V)   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                   ┌─────────────────────┐
                   │   Portal Inner       │
                   │   (staging)         │
                   └─────────────────────┘
```

## Teste 1: Registro de Agente

**Objetivo**: Validar que o agente consegue se registrar no portal.

### Passos

1. Obter token da empresa via admin:
   ```powershell
   # Via PowerShell
   $body = @{
     company_id = "uuid-da-empresa"
     hostname = "TEST-HOST-01"
     hypervisor = "hyper-v"
     os_version = (Get-CimInstance Win32_OperatingSystem).Caption
   } | ConvertTo-Json
   Invoke-RestMethod -Uri "https://staging.api.inner.com/api/agent/enroll" ...
   ```

2. Verificar que o arquivo de configuracao foi criado:
   ```powershell
   Test-Path "C:\Program Files\InnerAgent\config.json"
   ```

3. Verificar que o agente aparece na lista do admin:
   ```
   GET /api/admin/agents
   ```
   Esperado: agente com hostname `TEST-HOST-01` e status `online`

### Critério de sucesso
- Agente registrado com UUID retornado
- Config local com agent_id preenchido
- Listagem mostra agente online

---

## Teste 2: Métricas de Host

**Objetivo**: Validar que metricas de CPU, RAM e disco sao coletadas e armazenadas.

### Passos

1. Aguardar primeira coleta (intervalo padrao: 60s) ou forcar envio:
   ```powershell
   Start-Job -ScriptBlock {
     & "C:\Program Files\InnerAgent\inner-agent.ps1" -ForceSend
   }
   ```

2. Consultar metricas via API:
   ```
   GET /api/client/dashboard/metrics?agent_id={uuid}
   ```
   Esperado: JSON com `host_cpu_percent`, `host_memory_percent`, `host_disk_percent`

3. Verificar no banco (opcional):
   ```sql
   SELECT collected_at, host_cpu_percent, host_memory_percent
   FROM agent_metrics
   WHERE agent_id = 'uuid-do-agente'
   ORDER BY collected_at DESC
   LIMIT 5;
   ```

### Critério de sucesso
- CPU, RAM e Disk com valores entre 0-100
- Timestamps com granularidade de coleta

---

## Teste 3: VMs Detectadas

**Objetivo**: Validar que VMs Hyper-V sao automaticamente detectadas e reportadas.

### Passos

1. Listar VMs no host:
   ```powershell
   Get-VM | Select-Object Name, State, CPUUsage | Format-Table
   ```

2. Verificar metricas no portal:
   ```
   GET /api/client/servers?parent_id={host_uuid}
   ```
   Esperado: Lista com VMs como servidores filhos

3. Verificar metricas das VMs:
   ```
   GET /api/client/servers/{vm_uuid}
   ```
   Esperado: `is_virtual=true`, `vm_cpu_percent`, `vm_memory_percent`

### Critério de sucesso
- VMs listadas como servers com `vm_parent_id` apontando para host
- Metricas de cada VM presentes em `agent_metrics.virtual_machines`

---

## Teste 4: Heartbeat e Offline

**Objetivo**: Validar que o agente marca offline apos periodo sem envio.

### Passos

1. Verificar status inicial do agente:
   ```
   GET /api/admin/agents/{uuid}
   ```
   Esperado: `status: online`

2. Parar o servico do agente:
   ```powershell
   Stop-Service -Name "InnerAgent" -Force
   # ou matar o processo
   Stop-Process -Name "inner-agent" -Force
   ```

3. Aguardar 10 minutos (tempo de timeout configurado)

4. Verificar status no portal:
   ```
   GET /api/admin/agents/{uuid}
   ```
   Esperado: `status: offline`, `last_seen_at` com timestamp anterior

### Critério de sucesso
- Agente marca offline em ate 10min sem heartbeat
- Timestamp de offline coerente com momento da parada

---

## Teste 5: Reconexao e Retomada

**Objetivo**: Validar que metricas retomam apos reconexao do agente.

### Passos

1. Com agente offline ha 5 minutos, reiniciar:
   ```powershell
   Start-Service -Name "InnerAgent"
   # ou
   & "C:\Program Files\InnerAgent\inner-agent.ps1"
   ```

2. Aguardar envio das metricas (ate 2 minutos)

3. Verificar reconexao:
   ```
   GET /api/admin/agents/{uuid}
   ```
   Esperado: `status: online`, `last_seen_at` atualizado

4. Verificar metricas recentes:
   ```
   GET /api/client/dashboard/metrics?agent_id={uuid}&since={timestamp_agora}
   ```
   Esperado: Novas metricas apos reconexao

### Critério de sucesso
- Status retorna para online
- Metricas continuam sendo coletadas sem perda de historico

---

## Teste 6: Isolamento Multiempresa (Opcional)

**Objetivo**: Validar que metricas de uma empresa nao aparecem em outra.

### Passos

1. Registrar agente para Empresa A
2. Registrar agente para Empresa B (ambiente de teste)
3. Acessar portal como Empresa A
4. Verificar que agentes da Empresa B nao aparecem na listagem

### Critério de sucesso
- Filtro por `company_id` respeitado em todas as queries

---

## Checklist de Execucao

- [ ] Teste 1: Registro de Agente
- [ ] Teste 2: Metricas de Host
- [ ] Teste 3: VMs Detectadas
- [ ] Teste 4: Heartbeat e Offline
- [ ] Teste 5: Reconexao e Retomada
- [ ] Teste 6: Isolamento Multiempresa (opcional)

## Apendice: Comandos curl de referencia

```bash
# Registro
curl -X POST https://staging.api.inner.com/api/agent/enroll \
  -H "Content-Type: application/json" \
  -d '{"company_id":"uuid","hostname":"TEST-01","hypervisor":"hyper-v"}'

# Envio de metricas
curl -X POST https://staging.api.inner.com/api/agent/metrics/v2 \
  -H "Content-Type: application/json" \
  -H "X-Agent-ID: uuid" \
  -H "X-API-Key: chave" \
  -d @metrics-payload.json

# Heartbeat
curl -X POST https://staging.api.inner.com/api/agent/heartbeat \
  -H "X-Agent-ID: uuid" \
  -H "X-API-Key: chave"

# Listar agentes (admin)
curl https://staging.api.inner.com/api/admin/agents \
  -H "Authorization: Bearer $TOKEN"

# Ver metricas
curl "https://staging.api.inner.com/api/client/dashboard/metrics?agent_id=uuid" \
  -H "Authorization: Bearer $TOKEN"
```
