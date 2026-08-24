# 📂 Backend

## Conteúdo

Documentação do backend (Fastify/Node.js/TypeScript).

---

## 📄 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [[README]] | Visão geral do backend |
| [[API-Routes]] | Todas as rotas da API |
| [[Serviços]] | Lógica de negócio e integrações |

---

## 🔗 Links Úteis

- [[02-Arquitetura/Diagrama-de-Arquitetura|Arquitetura]]
- [[05-Banco-de-Dados/README| Banco de Dados]]
- [[06-Integrações/README|Integrações]]

---

## 📦 Serviços Principais

1. **zabbix-service.ts** - Integração Zabbix
2. **glpi-service.ts** - Integração GLPI
3. **ms-graph-service.ts** - Microsoft 365
4. **agent-metrics-service.ts** - Métricas de agentes
5. **crypto-service.ts** - Criptografia

---

## 🛣️ Rotas por Prefixo

| Prefixo | Descrição |
|---------|-----------|
| `/api/auth/*` | Autenticação |
| `/api/agent/*` | Agentes |
| `/api/admin/*` | Rotas administrativas |
| `/api/client/*` | Rotas de cliente |

---

> **Atualizado:** 2026-08
