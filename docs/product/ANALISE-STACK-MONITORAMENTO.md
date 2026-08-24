# Análise: Stack Customizada vs Soluções de Mercado

**Data:** 2026-08-24  
**Objetivo:** Avaliar se vale a pena continuar investindo na stack customizada de monitoramento

---

## 1. Estado Atual do Monitoring Custom

### O que funciona ✅
| Componente | Status | Observação |
|------------|--------|------------|
| Agente endpoint (JS) | ⚠️ Parcial | CPU mostra 0%, WMI fallback implementado |
| Coletor rede (JS) | ❌ Problema | Encontra devices, não persiste no portal |
| Backend API | ✅ Funcional | Processa métricas, cria asset_profiles |
| Database schema | ✅ Estruturado | Tabelas servers, network_devices, asset_profiles |

### O que não funciona ❌
| Problema | Causa | Impacto |
|----------|-------|---------|
| CPU 0% | `os.cpus()` impreciso | Métricas sem utilidade |
| Devices não aparecem | `customer_visible = false` | Portal vazio |
| Sem SNMP real | `snmpWalk()` é stub | Coletor não funciona |
| Sem debug | Falta logging | Difícil diagnosticar |

---

## 2. Esforço para Corrigir vs Migrar

### Opção A: Corrigir Stack Customizada

**Tempo estimado:**
- CPU: 2-4h (já feito parcialmente)
- Visibility: 1h (já feito)
- SNMP real: 40-80h (requer lib externa)
- Robustez: 20-40h

**Total: ~60-120h**

**Vantagens:**
- Controle total da lógica
- Sem dependências externas
- Uma stack para manter

**Desvantagens:**
- Manutenção contínua necessária
- Bugs próprios para resolver
- Sem comunidade/suporte
- Cada feature precisa implementar do zero

---

### Opção B: Adotar Stack de Mercado

**Stack recomendada: Telegraf + InfluxDB + Grafana**

| Componente | Solução | Custo |
|------------|---------|-------|
| Agente servidor | Telegraf (windows_exporter) | Gratuito |
| Agente rede | Telegraf (SNMP plugin) | Gratuito |
| Armazenamento | InfluxDB | Gratuito (self-hosted) |
| Visualização | Grafana | Gratuito (self-hosted) |
| Backend API | Inner atual | - |

**Tempo estimado:**
- Integração Telegraf→API: 8-16h
- Migração dashboards: 16-24h
- Treinamento: 4-8h

**Total: ~28-48h**

**Vantagens:**
- Agentes testados e maduros
- SNMP nativo e robusto
- Comunidade ativa
- Debugging fácil (PromQL, dashboards prontos)
- Alertas nativos

**Desvantagens:**
- Nova infraestrutura para manter
- Integração com portal atual requer trabalho
- Curva de aprendizado

---

## 3. Comparativo de Recursos

| Recurso | Custom | Telegraf+Grafana |
|---------|--------|------------------|
| CPU/ RAM/ Disco | ⚠️ Impreciso | ✅ Preciso |
| SNMP real | ❌ Stub | ✅ Nativo |
| Discovery automático | ❌ Não | ✅ Sim |
| Métricas de rede | ❌ Não | ✅ Switches, routers |
| Gráficos históricos | ✅ Básico | ✅ Avançado |
| Alertas | ❌ Não | ✅ Nativo |
| Multi-tenancy | ⚠️ Manual | ⚠️ Requer config |
| Manutenção | Alta | Baixa |

---

## 4. Recomendações por Prioridade

### Se o problema é **rapidez de implementação**:

**Manter custom por agora**, mas com foco em:
1. Corrigir CPU (fallback WMI) ✅ Feito
2. Corrigir visibility ✅ Feito
3. Implementar SNMP real (usar lib `snmp-native` ou similar)
4. Adicionar logging

### Se o problema é **confiabilidade de longo prazo**:

**Migrar para Telegraf + InfluxDB + Grafana**:
1. Rodar Telegraf nos servidores Windows
2. Configurar SNMP plugin para dispositivos
3. Criar dashboards no Grafana
4. Construir API que lê do InfluxDB
5. Manter portal atual consumindo API

### Se o problema é **custo zero e controle total**:

**Manter custom + melhorar**:
1. Implementar SNMP real com lib Node.js
2. Adicionar testes automatizados
3. Documentar e criar runbook

---

## 5. Próximos Passos Recomendados

### Curto prazo (1-2 semanas):
1. Testar correções aplicadas (CPU e visibility)
2. Se funcionar, seguir com SNMP real
3. Se não funcionar, reconsiderar migração

### Médio prazo (1-2 meses):
1. Avaliar Telegraf como alternativa
2. Se escolher Telegraf, implementar POC
3. Migrar gradualmente

---

## 6. Perguntas para Decisão Final

1. **Qual é mais importante?** Velocidade ou confiabilidade?
2. **Temos capacidade de manter nova infraestrutura?** (InfluxDB, Grafana)
3. **Qual o budget para ferramentas?** (Telegraf/Grafana são gratuitos)
4. **Quando precisamos de SNMP funcionando?** Urgência?

---

## Conclusão Preliminar

A stack customizada tem potencial mas requer investimento significativo (~60-120h) para ficar robusta. Soluções de mercado como Telegraf+Grafana oferecem confiabilidade comprovada em ~28-48h.

**Recomendação:** Começar com Telegraf como POC para validar se atende as necessidades antes de investir mais na stack customizada.
