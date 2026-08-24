# ✨ Funcionalidades Principais

## Visão Geral dos Módulos

O Portal Inner é composto por módulos integrados que fornecem visibilidade completa sobre a infraestrutura do cliente.

---

## 📊 Dashboard Principal

O dashboard central exibe uma visão consolidada do estado do ambiente.

### Cards de Status
- **MS365:** Status geral do Microsoft 365
- **Servidores:** Saúde dos servidores físicos
- **Saúde Geral:** Indicador consolidado

### Alertas Rápidos
- Notificações de problemas críticos
- Acesso direto aos módulos afetados

---

## ☁️ Microsoft 365

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Licenças** | Monitoramento de uso vs disponível |
| **Usuários Ativos** | Contagem e listagem |
| **SharePoint** | Uso de armazenamento |
| ** Teams** | Estatísticas de uso |

### Dados Via API
```typescript
interface MS365Metrics {
  totalUsers: number;
  activeUsers: number;
  licensesUsed: number;
  licensesAvailable: number;
  sharePointUsedGB: number;
  sharePointTotalGB: number;
}
```

### Tela
- **Rota:** `/microsoft`
- **Componente:** `pages/paginasClient/Microsoft/microsoft.jsx`
- **Serviço:** `services/ms-graph-service.ts`

---

## 🖥️ Servidores Físicos

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Status Real-time** | CPU, Memória, Rede |
| **Histórico** | Gráficos de evolução |
| **Eventos** | Log de eventos por servidor |
| **Alertas** | Threshold alerts |

### Métricas Monitoradas
- **CPU:** Uso percentual
- **Memória:** Uso em GB/%
- **Rede:** Bytes in/out
- **Disco:** Espaço disponível

### Tela
- **Rota:** `/servidores`
- **Componente:** `pages/paginasClient/Servidores/servidores.jsx`
- **Serviço:** `services/zabbix-service.ts`
- **Agente:** Python agent via `agent-metrics-service.ts`

---

## 🔧 Chamados GLPI

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Listagem** | Todos os chamados do contrato |
| **Filtros** | Status, categoria, data |
| **Busca** | Pesquisa por palavra-chave |
| **Indicadores SLA** | Tempos de resposta/resolução |
| **Detalhe** | Visualização completa |

### Indicadores SLA

| Indicador | Descrição |
|-----------|-----------|
| **Tempo Primeiro Response** | Tempo até primeira resposta |
| **Tempo Resolução** | Tempo até fechamento |
| **Taxa Cumprimento** | % dentro do SLA |

### Tela
- **Rota:** `/chamados`
- **Componente:** `pages/paginasClient/ChamadosGLPI/chamados.jsx`
- **Serviço:** `services/glpi-service.ts`

---

## 🌐 Rede

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Status Conectividade** | Online/Offline |
| **Latência** | Tempo de resposta em ms |
| **Uptime** | Disponibilidade % |
| **Filtros** | Por status, tipo |

### Tela
- **Rota:** `/rede`
- **Componente:** `pages/paginasClient/Rede/rede.jsx`
- **Serviço:** `routes/client/network-routes.ts`

---

## 📄 Documentação Técnica

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Visualizador** | Leitura de documentos |
| **Categorias** | Filtro por categoria |
| **Busca** | Por palavra-chave |
| **Upload** | Admin pode adicionar |
| **Download** | Baixar documentos |

### Categorias
- Procedimentos
- Arquitetura
- Manuais
- Relatórios
- Contratos

### Tela
- **Rota:** `/documentacao`
- **Componente:** `pages/paginasClient/Documentação/documentacao.jsx`
- **Admin:** `pages/paginasAdmin/docAdmin/docAdmin.jsx`

---

## 👤 Minha Conta

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Perfil** | Dados do usuário |
| **Alterar Senha** | Troca de senha |
| **Notificações** | Preferências |
| **Empresa** | Dados do contrato |

### Tela
- **Rota:** `/conta`
- **Componente:** `pages/paginasClient/Conta/conta.jsx`
- **Admin:** `pages/paginasAdmin/configAdmin/configAdmin.jsx`

---

## 🔒 Segurança

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| **Credenciais** | Gestão de tokens |
| **Logs** | Auditoria de acessos |
| **Alertas** | Tentativas suspeitas |

### Tela
- **Rota:** `/seguranca`
- **Componente:** `pages/paginasClient/Segurança/seguranca.jsx`
- **Admin:** `pages/paginasAdmin/segurancaAdmin/segurancaAdmin.jsx`

---

## 🖥️ Painel Administrativo

### Funcionalidades Admin

| Módulo | Descrição |
|--------|-----------|
| **Dashboard Admin** | Visão geral do sistema |
| **Empresas** | Gestão de clientes |
| **Usuários** | Gestión de acessos |
| **Inventário** | Ativos cadastrados |
| **Configurações** | Parâmetros do sistema |
| **Auditoria** | Logs de atividades |
| **Documentos** | Upload/gestão docs |
| **Agentes** | Monitoramento agentes |
| **SNMP** | Coletores SNMP |

### Arquivo de Rotas Admin
- `pages/paginasAdmin/*`
- `routes/admin/*`

---

## 📱 Responsividade

Todas as funcionalidades são responsivas, com adaptações:

| Tela | Adaptação |
|------|-----------|
| **Desktop** | Layout completo |
| **Tablet** | Sidebar colapsável |
| **Mobile** | Menu hamburger, cards empilhados |

---

## 🔄 Atualização em Tempo Real

O sistema utiliza **Supabase Realtime** para:

1. **Dashboards:** Atualização instantânea de métricas
2. **Alertas:** Notificações push
3. **Tabelas:** Refresh automático
4. **Status:** Indicadores live

---

## 📈 Funcionalidades Futuras

| Feature | Status | Prioridade |
|---------|--------|------------|
| App Mobile | Planejado | Alta |
| Relatórios PDF | Planejado | Média |
| Webhooks | Planejado | Média |
| API Pública | Planejado | Baixa |

---

> **Última atualização:** 2026-08
