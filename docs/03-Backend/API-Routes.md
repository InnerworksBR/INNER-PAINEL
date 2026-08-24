# 🛣️ Rotas da API

## Visão Geral

A API REST do Portal Inner é organizada em rotas administrativas e de cliente, seguindo o padrão RESTful.

---

## 🌐 Rotas de Autenticação

### `POST /api/auth/login`
Login de usuário

```typescript
// Request
{
  "email": "string",
  "password": "string"
}

// Response
{
  "token": "jwt_token",
  "user": {
    "id": "uuid",
    "email": "string",
    "name": "string",
    "role": "admin" | "client",
    "companyId": "uuid"
  }
}
```

### `POST /api/auth/logout`
Logout de usuário (invalida token)

### `GET /api/auth/me`
Retorna dados do usuário autenticado

### `PUT /api/auth/me`
Atualiza dados do perfil

### `POST /api/auth/change-password`
Altera senha do usuário

---

## 🔧 Rotas de Agentes

### `POST /api/agent/enroll`
Registro de novo agente

```typescript
// Request
{
  "activationToken": "string",
  "hostname": "string",
  "ip": "string",
  "platform": "string"
}

// Response
{
  "agentId": "uuid",
  "apiToken": "encrypted_token"
}
```

### `POST /api/agent/metrics`
Envio de métricas pelo agente

```typescript
// Headers
Authorization: Bearer <api_token>

// Request
{
  "cpu": number,       // 0-100
  "memory": number,    // 0-100
  "disk": number,      // 0-100
  "vms": number,       // count
  "timestamp": "ISO8601"
}
```

### `POST /api/agent/heartbeat`
Heartbeat do agente (keep-alive)

### `GET /api/agent/config`
Retorna configuração do agente

---

## 📊 Rotas Admin

### Dashboard Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/dashboard/summary` | Resumo geral |
| GET | `/api/admin/dashboard/companies` | Lista de empresas |
| GET | `/api/admin/dashboard/stats` | Estatísticas |

### Gestão de Empresas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/companies` | Lista todas |
| GET | `/api/admin/companies/:id` | Detalhes |
| POST | `/api/admin/companies` | Cria empresa |
| PUT | `/api/admin/companies/:id` | Atualiza |
| DELETE | `/api/admin/companies/:id` | Remove |

### Gestão de Usuários

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/users` | Lista usuários |
| GET | `/api/admin/users/:id` | Detalhes |
| POST | `/api/admin/users` | Cria usuário |
| PUT | `/api/admin/users/:id` | Atualiza |
| DELETE | `/api/admin/users/:id` | Remove |
| POST | `/api/admin/users/:id/block` | Bloqueia |
| POST | `/api/admin/users/:id/unblock` | Desbloqueia |
| POST | `/api/admin/users/:id/reset-password` | Reset senha |

### Inventário

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/inventory` | Lista ativos |
| GET | `/api/admin/inventory/:id` | Detalhes |
| POST | `/api/admin/inventory` | Cria ativo |
| PUT | `/api/admin/inventory/:id` | Atualiza |
| DELETE | `/api/admin/inventory/:id` | Remove |

### Documentos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/docs` | Lista documentos |
| POST | `/api/admin/docs/upload` | Upload |
| DELETE | `/api/admin/docs/:id` | Remove |

### MS365

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/ms365/config/:companyId` | Configuração |
| PUT | `/api/admin/ms365/config/:companyId` | Atualiza config |
| POST | `/api/admin/ms365/sync/:companyId` | Força sincronização |

### Agentes Admin

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/agents` | Lista agentes |
| GET | `/api/admin/agents/:id` | Detalhes |
| DELETE | `/api/admin/agents/:id` | Remove |
| POST | `/api/admin/agents/:id/refresh-token` | Renova token |

### SNMP

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/snmp/collectors` | Lista coletores |
| POST | `/api/admin/snmp/collectors` | Cria coletor |
| PUT | `/api/admin/snmp/collectors/:id` | Atualiza |
| DELETE | `/api/admin/snmp/collectors/:id` | Remove |
| POST | `/api/admin/snmp/discover` | Descobre dispositivos |

### Auditoria

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/audit-logs` | Lista logs |
| GET | `/api/admin/audit-logs/:id` | Detalhes |

### Configurações

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/settings` | Lista configurações |
| PUT | `/api/admin/settings/:key` | Atualiza |

### Segurança

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/admin/security/policy` | Política de segurança |
| PUT | `/api/admin/security/policy` | Atualiza política |

---

## 👤 Rotas de Cliente

### Dashboard

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/dashboard/summary/:contractId` | Resumo |

### Métricas

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/metrics/servers/:contractId` | Servidores |
| GET | `/api/client/metrics/history/:contractId` | Histórico |
| GET | `/api/client/metrics/events/:contractId` | Eventos |

### GLPI

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/glpi/tickets/:contractId` | Lista chamados |
| GET | `/api/client/glpi/tickets/:contractId/:ticketId` | Detalhes |
| GET | `/api/client/glpi/stats/:contractId` | Estatísticas SLA |

### Rede

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/network/devices/:contractId` | Dispositivos |

### Documentos

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/docs/:contractId` | Lista documentos |
| GET | `/api/client/docs/:contractId/:docId/download` | Download |

### Segurança

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/client/security/status/:contractId` | Status |

---

## 🔒 Autenticação nas Rotas

### Header de Autenticação

```http
Authorization: Bearer <jwt_token>
```

### Roles por Rota

| Prefix | Roles Permitidas |
|--------|------------------|
| `/api/admin/*` | `admin` |
| `/api/client/*` | `admin`, `client` |
| `/api/agent/*` | Agent API Token |

---

## 📝 Schema de Erro

```typescript
interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: any;
}

// Exemplo
{
  "statusCode": 401,
  "error": "Unauthorized",
  "message": "Token inválido ou expirado"
}
```

---

## ✅ Códigos de Status

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Criado |
| 204 | Sem conteúdo |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |

---

> **Última atualização:** 2026-08
