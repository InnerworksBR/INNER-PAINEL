# 🔷 Portal Inner - Documentação do Projeto

> Sistema centralizado de monitoramento e gestão para gestores de contrato

Este vault contém toda a documentação técnica e de negócio do Portal Inner, incluindo arquitetura, integrações, decisões de projeto e guias de implementação.

---

## 📚 Índice Principal

### Visão Geral
- [[01-Visão-Geral/README|Visão Geral do Projeto]]
- [[01-Visão-Geral/Stack-Tecnológica|Stack Tecnológica]]
- [[01-Visão-Geral/Funcionalidades|Funcionalidades Principais]]
- [[01-Visão-Geral/Perfis-de-Acesso|Perfis de Acesso]]

### Arquitetura
- [[02-Arquitetura/Diagrama-de-Arquitetura|Arquitetura do Sistema]]
- [[02-Arquitetura/Fluxo-de-Dados|Fluxo de Dados]]
- [[02-Arquitetura/Segurança|Arquitetura de Segurança]]

### Backend
- [[03-Backend/README|Visão Geral Backend]]
- [[03-Backend/API-Routes|Rotas da API]]
- [[03-Backend/Serviços|Serviços]]
- [[03-Backend/Autenticação|Autenticação JWT]]
- [[03-Backend/Plugins|Plugins Fastify]]

### Frontend
- [[04-Frontend/README|Visão Geral Frontend]]
- [[04-Frontend/Componentes|Componentes Principais]]
- [[04-Frontend/Páginas|Páginas e Layouts]]
- [[04-Frontend/Contextos|Contextos React]]

### Banco de Dados
- [[05-Banco-de-Dados/README|Visão Geral BD]]
- [[05-Banco-de-Dados/Schema|Schema do Banco]]
- [[05-Banco-de-Dados/Migrations|Migrations]]

### Integrações
- [[06-Integrações/README|Integrações]]
- [[06-Integrações/Zabbix|Zabbix]]
- [[06-Integrações/GLPI|GLPI]]
- [[06-Integrações/MS-Graph|Microsoft 365]]

### Implementações
- [[07-Implementações/README|Índice de Implementações]]
- [[07-Implementações/001-Responsividade|001 - Responsividade Web]]
- [[07-Implementações/002-GLPI-SLA|002 - Controle GLPI e SLA]]
- [[07-Implementações/003-Login|003 - Login e Recuperação]]
- [[07-Implementações/006-Correcoes|006 - Correções GLPI]]
- [[07-Implementações/010-Baseline|010 - Baseline Qualidade]]
- [[07-Implementações/011-Seguranca|011 - Segurança]]

### Guias
- [[08-Guias/README|Guias]]
- [[08-Guias/Setup|Setup de Desenvolvimento]]
- [[08-Guias/Deploy|Deploy]]
- [[08-Guias/Testes|Testes]]

### Decisões (ADRs)
- [[09-Decisões/README|Índice de ADRs]]

### Agentes
- [[10-Agentes/README|Agentes de Monitoramento]]
- [[10-Agentes/Arquitetura|Arquitetura de Agentes]]
- [[10-Agentes/SNMP|SNMP Collector]]

---

## 🔗 Links Rápidos

| Recurso | Link |
|---------|------|
| Repositório | [GitHub](https://github.com/InnerworksBR/inner-painel) |
| Backend API | `/backend/src/app.ts` |
| Frontend | `/web/src/` |
| Database | Supabase PostgreSQL |

---

## 📊 Status do Projeto

| Módulo | Status |
|--------|--------|
| Backend API | 🟢 Ativo |
| Frontend Web | 🟢 Ativo |
| Zabbix | 🟢 Integrado |
| GLPI | 🟢 Integrado |
| MS365 | 🟢 Integrado |
| Agentes | 🟡 Em Desenvolvimento |

---

## 🏷️ Tags Úteis

#projeto #portal-inner #monitoramento #gestão
