# 📂 Banco de Dados

## Conteúdo

Documentação do schema, migrations e segurança do banco de dados.

---

## 📄 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [[README]] | Visão geral do BD |

---

## 🗄️ Tabelas Principais

| Tabela | Descrição |
|--------|-----------|
| `companies` | Empresas clientes |
| `contracts` | Contratos |
| `profiles` | Perfis de usuário |
| `servers` | Servidores monitorados |
| `server_metrics` | Métricas históricas |
| `glpi_tickets` | Chamados GLPI |
| `ms365_metrics` | Métricas MS365 |
| `documents` | Documentos técnicos |
| `registered_agents` | Agentes registrados |
| `audit_logs` | Logs de auditoria |

---

## 🔐 Segurança

### Row Level Security (RLS)

- Isolamento por `company_id`
- Roles: `admin` vs `client`
- Filtros automáticos em queries

### Índices

- `idx_servers_contract`
- `idx_glpi_tickets_contract`
- `idx_server_metrics_server`

---

## 📁 Migrations

| Migration | Descrição |
|-----------|-----------|
| `migration_001.sql` | Schema inicial |
| `migration_003.sql` | Campos GLPI |
| `migration_005.sql` | Integrações |
| `migration_010.sql` | Asset profiles |
| `migration_011.sql` | Agentes + SNMP |

---

## 🔗 Links Úteis

- [[03-Backend/Serviços|Serviços Backend]]
- [[02-Arquitetura/Segurança|Segurança]]

---

> **Atualizado:** 2026-08
