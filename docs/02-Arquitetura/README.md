# 📂 Arquitetura

## Conteúdo

Documentação da arquitetura do sistema.

---

## 📄 Arquivos

| Arquivo | Descrição |
|---------|-----------|
| [[Diagrama-de-Arquitetura]] | Visão geral e diagramas |
| [[Fluxo-de-Dados]] | Ciclo de vida dos dados |
| [[Segurança]] | Arquitetura de segurança |
| [[Perfis-de-Acesso]] | RBAC e permissões |

---

## 🏗️ Arquitetura de Alto Nível

```
Frontend (React)
    ↓
Backend (Fastify)
    ↓
├── Zabbix Service
├── GLPI Service
├── MS Graph Service
├── Agent Service
└── SNMP Service
    ↓
Supabase (PostgreSQL + Realtime)
```

---

## 🔗 Links Úteis

- [[01-Visão-Geral/Stack-Tecnológica|Stack Tecnológica]]
- [[03-Backend/README|Backend]]
- [[05-Banco-de-Dados/README|Banco de Dados]]

---

> **Atualizado:** 2026-08
