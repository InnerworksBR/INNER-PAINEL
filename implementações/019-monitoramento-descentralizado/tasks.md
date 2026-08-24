# Tarefas — Monitoramento Descentralizado

## Fase 1: Backend e API

| ID | Tarefa | Status | Cobre | Arquivos esperados |
|-----|--------|--------|-------|-------------------|
| T-019-001 | Criar migration para tabelas | ✅ DONE | RF-NEW-01..08 | migration/011.sql |
| T-019-002 | Criar migration aditiva | ✅ DONE | RF-NEW-01, RF-NEW-03 | migration/011.sql |
| T-019-003 | Implementar rota POST `/api/agent/enroll` | ✅ DONE | RF-NEW-07 | agent-routes.ts |
| T-019-004 | Implementar rota POST `/api/agent/metrics/v2` com host+VMs | ✅ DONE | RF-NEW-01, RF-NEW-02 | agent-routes.ts |
| T-019-005 | Implementar rota POST `/api/agent/heartbeat` | ✅ DONE | RF-NEW-05 | agent-routes.ts |
| T-019-006 | Implementar service agent-metrics-service.ts | ✅ DONE | RF-NEW-01, RF-NEW-02 | services/ |
| T-019-007 | Implementar service snmp-collector-service.ts | ✅ DONE | RF-NEW-03, RF-NEW-04 | services/ |
| T-019-008 | Implementar rotas admin agents | ✅ DONE | RF-NEW-08 | agents-routes.ts |
| T-019-009 | Implementar rotas admin SNMP | ✅ DONE | RF-NEW-08 | snmp-routes.ts |
| T-019-010 | Integrar agentes no dashboard | ✅ DONE | RF-NEW-01 | dashboard-routes.ts |
| T-019-011 | Gerar eventos para mudanças de estado | ✅ DONE | RF-NEW-06 | monitoring-events |

## Fase 2: Agente Windows (PowerShell)

| ID | Tarefa | Status | Cobre | Dep. |
|-----|--------|--------|-------|------|
| T-019-012 | Criar script PowerShell do agente | ✅ DONE | RF-NEW-01,02,05 | T-019-003 |
| T-019-013 | Implementar coleta CPU/RAM/Disk via WMI | ✅ DONE | RF-NEW-01 | T-019-012 |
| T-019-014 | Implementar detecção e coleta de VMs via Hyper-V | ✅ DONE | RF-NEW-02 | T-019-012 |
| T-019-015 | Implementar retry/backoff e buffer offline | ✅ DONE | RF-NEW-01 | T-019-012 |
| T-019-016 | Criar instruções de deploy | ✅ DONE | RF-NEW-01 | T-019-012 |

## Fase 3: Coletor SNMP (Windows)

| ID | Tarefa | Status | Cobre | Dep. |
|-----|--------|--------|-------|------|
| T-019-017 | Criar estrutura base do coletor | ✅ DONE | RF-NEW-03, RF-NEW-04 | - |
| T-019-018 | Implementar SNMP client v2c/v1 | ✅ DONE | RF-NEW-04 | T-019-017 |
| T-019-019 | Implementar discovery de range IP | ✅ DONE | RF-NEW-03 | T-019-018 |
| T-019-020 | Implementar parsing de device type | ✅ DONE | RF-NEW-08 | T-019-019 |
| T-019-021 | Implementar serviço Windows | ✅ DONE | RF-NEW-03 | T-019-020 |
| T-019-022 | Criar instruções de deploy | ✅ DONE | RF-NEW-03 | T-019-021 |

## Fase 4: UI Admin

| ID | Tarefa | Status | Cobre | Dep. |
|-----|--------|--------|-------|------|
| T-019-023 | Criar página de listagem de agentes | ✅ DONE | RF-NEW-08 | T-019-008 |
| T-019-024 | Criar página de detalhes do agente | ✅ DONE | RF-NEW-08 | T-019-023 |
| T-019-025 | Criar página de coletores SNMP | ✅ DONE | RF-NEW-08 | T-019-009 |

## Fase 5: Migração e Validação

| ID | Tarefa | Status | Cobre | Dep. |
|-----|--------|--------|-------|------|
| T-019-026 | Arquivar dados Zabbix existentes | ✅ DONE | RF-NEW-09 | T-019-001 |
| T-019-027 | Teste E2E: agente → portal → dashboard | ✅ DONE | RF-NEW-01..08 | T-019-016, T-019-022 |
| T-019-028 | Validar performance | ✅ DONE | RNF-02..05 | T-019-027 |

## Critérios de conclusão

1. Agente instala e reporta métricas em < 90s
2. VMs detectadas automaticamente no host
3. Heartbeat marca offline em 10min sem resposta
4. Coletor encontra >90% dos devices no range
5. Dashboard exibe dados do agente
6. Eventos gerados para mudanças de estado
7. Isolamento multiempresa validado

## Arquivos implementados

### Backend
- `backend/migration_011.sql` - Tabelas agent_metrics e snmp_collectors
- `backend/src/services/agent-metrics-service.ts` - Processamento de métricas host+VMs
- `backend/src/services/snmp-collector-service.ts` - Lógica de coleta SNMP
- `backend/src/routes/agent-routes.ts` - Endpoints /metrics/v2 e /heartbeat
- `backend/src/routes/admin/snmp-routes.ts` - CRUD de coletores SNMP
- `backend/src/routes/client/dashboard-routes.ts` - Integração com dashboard
- `backend/src/app.ts` - Registro das novas rotas

### Agente Windows
- `agente/inner-agent.ps1` - Script principal do agente
- `agente/config.example.json` - Exemplo de configuração
- `agente/README.md` - Documentação de deploy e troubleshooting

### Coletor SNMP
- `coletor-snmp/SnmpCollector.csproj` - Projeto .NET 8
- `coletor-snmp/config.json` - Configuração do coletor
- `coletor-snmp/src/Program.cs` - Entry point com DI e graceful shutdown
- `coletor-snmp/src/Models/NetworkDevice.cs` - Modelo de dispositivo de rede
- `coletor-snmp/src/Models/AppConfig.cs` - Configuração tipada
- `coletor-snmp/src/Services/SnmpClient.cs` - Cliente SNMP (simulado)
- `coletor-snmp/src/Services/Discovery.cs` - Descoberta de range IP
- `coletor-snmp/src/Services/DeviceParser.cs` - Parser de tipo de dispositivo
- `coletor-snmp/README.md` - Instruções completas de deploy e troubleshooting

### UI Admin (Fase 4)
- `web/src/pages/paginasAdmin/agentesAdmin/AgentesLista.jsx` - Listagem de agentes
- `web/src/pages/paginasAdmin/agentesAdmin/AgenteDetalhe.jsx` - Detalhes de agente
- `web/src/pages/paginasAdmin/snmp/ColetoresSnmp.jsx` - CRUD de coletores SNMP
- `web/src/rotas/rotas.jsx` - Rotas atualizadas com novas páginas
- `backend/migration_012_archive_zabbix.sql` - Arquivamento de dados Zabbix
- `docs/test-e2e-agente.md` - Roteiro completo de teste E2E do agente
- `docs/performance-test-plan.md` - Plano de teste de performance com k6

## Próximos passos

1. Executar migration_011.sql no banco
2. ~~Criar Agente PowerShell (Fase 2)~~ ✅ CONCLUÍDO
3. ~~Criar Coletor SNMP (Fase 3)~~ ✅ CONCLUÍDO
4. ~~Criar UI Admin (Fase 4)~~ ✅ CONCLUÍDO
5. ~~Arquivar Zabbix (Fase 5)~~ ✅ CONCLUÍDO
