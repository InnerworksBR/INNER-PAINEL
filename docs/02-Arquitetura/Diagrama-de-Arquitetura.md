# 🏗️ Diagrama de Arquitetura

## Visão Geral da Arquitetura

O Portal Inner segue uma arquitetura **monolítica modular** com separação clara entre frontend e backend.

---

## 📐 Arquitetura de Alto Nível

```mermaid
graph TB
    subgraph Clients["👥 Clientes"]
        Browser["🌐 Browser"]
        Mobile["📱 Mobile (Futuro)"]
    end
    
    subgraph WebServer["🌐 Servidor Web"]
        Nginx["Nginx / CDN"]
    end
    
    subgraph Backend["⚙️ Backend (Node.js)"]
        Fastify["Fastify API"]
        Jobs["Cron Jobs"]
        Plugins["Plugins"]
    end
    
    subgraph ServicesLayer["📦 Serviços"]
        Zabbix["Zabbix Service"]
        GLPI["GLPI Service"]
        MSGraph["MS Graph Service"]
        Storage["Storage Service"]
        Crypto["Crypto Service"]
        Audit["Audit Service"]
    end
    
    subgraph DataLayer["💾 Dados"]
        Supabase["Supabase"]
        PostgreSQL[("PostgreSQL")]
        Realtime["Realtime"]
        StorageBuckets["Storage"]
    end
    
    subgraph External["🔌 Externos"]
        ZabbixAPI["Zabbix API"]
        GLPIAPI["GLPI API"]
        MSGraphAPI["Microsoft Graph"]
        Agents["Agentes Python"]
    end
    
    Browser --> Nginx
    Mobile --> Nginx
    Nginx --> Fastify
    
    Fastify --> Jobs
    Fastify --> Plugins
    
    Zabbix --> ZabbixAPI
    GLPI --> GLPIAPI
    MSGraph --> MSGraphAPI
    
    Zabbix --> Supabase
    GLPI --> Supabase
    MSGraph --> Supabase
    
    Supabase --> PostgreSQL
    Supabase --> Realtime
    Supabase --> StorageBuckets
    
    Realtime -.-> Browser
    StorageBuckets -.-> Browser
    
    Agents --> Zabbix
```

---

## 🔀 Arquitetura de Requisições

```mermaid
sequenceDiagram
    participant U as Usuário
    participant N as Nginx
    participant F as Fastify
    participant S as Services
    participant DB as Supabase
    participant E as APIs Externas
    
    rect rgb(240, 248, 255)
        Note over U,E: Fluxo Normal
    end
    
    U->>N: HTTPS Request
    N->>F: Proxy Pass
    F->>F: JWT Validation
    F->>S: Call Service
    S->>E: Fetch Data
    E-->>S: Response
    S->>DB: Cache/Persist
    DB-->>S: Confirmation
    S-->>F: Processed Data
    F-->>N: JSON Response
    N-->>U: Response
    
    rect rgb(255, 240, 245)
        Note over F,DB: Realtime Update
    end
    
    DB->>U: Realtime Event
```

---

## 📁 Estrutura de Diretórios

### Backend

```
backend/
├── src/
│   ├── app.ts              # Configuração principal do Fastify
│   ├── server.ts           # Entry point
│   ├── types.ts            # Tipos TypeScript globais
│   │
│   ├── routes/             # Rotas da API
│   │   ├── auth.ts         # Autenticação
│   │   ├── agent-routes.ts # Rotas de agentes
│   │   │
│   │   ├── admin/          # Rotas administrativas
│   │   │   ├── agents-routes.ts
│   │   │   ├── audit-routes.ts
│   │   │   ├── companies-routes.ts
│   │   │   ├── config-routes.ts
│   │   │   ├── dashboard-routes.ts
│   │   │   ├── docs-routes.ts
│   │   │   ├── inventory-routes.ts
│   │   │   ├── ms365-routes.ts
│   │   │   ├── security-routes.ts
│   │   │   ├── settings-routes.ts
│   │   │   ├── snmp-routes.ts
│   │   │   └── users-routes.ts
│   │   │
│   │   └── client/         # Rotas de clientes
│   │       ├── dashboard-routes.ts
│   │       ├── docs-routes.ts
│   │       ├── glpi-routes.ts
│   │       ├── metrics-routes.ts
│   │       ├── network-routes.ts
│   │       └── security-routes.ts
│   │
│   ├── services/           # Lógica de negócio
│   │   ├── agent-metrics-service.ts
│   │   ├── asset-profile-service.ts
│   │   ├── audit-service.ts
│   │   ├── company-scope-service.ts
│   │   ├── crypto-service.ts
│   │   ├── glpi-service.ts
│   │   ├── history-service.ts
│   │   ├── integration-status-service.ts
│   │   ├── monitoring-events-service.ts
│   │   ├── ms-graph-service.ts
│   │   ├── settings-service.ts
│   │   ├── snmp-collector-service.ts
│   │   ├── storage-service.ts
│   │   └── zabbix-service.ts
│   │
│   ├── plugins/            # Plugins Fastify
│   │   ├── cors.ts
│   │   ├── jwt.ts
│   │   ├── maintenance.ts
│   │   ├── multipart.ts
│   │   └── supabase.ts
│   │
│   ├── hooks/              # Hooks Fastify
│   │   └── auth-hook.ts
│   │
│   └── jobs/              # Jobs cron
│       └── sync-scheduler.ts
│
├── migrations/            # Scripts SQL
│   ├── migration_001.sql
│   └── ...
│
├── package.json
└── tsconfig.json
```

### Frontend

```
web/
├── src/
│   ├── main.jsx           # Entry point
│   ├── App.jsx            # Componente raiz
│   │
│   ├── components/       # Componentes reutilizáveis
│   │   ├── AssetDetailDrawer.jsx
│   │   ├── MobileHeader.jsx
│   │   ├── ProtectedRoute.jsx
│   │   ├── Sidebar.jsx
│   │   ├── SidebarAdmin.jsx
│   │   ├── TicketDetailDrawer.jsx
│   │   └── ...
│   │
│   ├── contexts/          # React Contexts
│   │   ├── AuthContext.jsx
│   │   ├── ClientPreviewContext.jsx
│   │   └── CompanyContext.jsx
│   │
│   ├── layouts/           # Layouts de página
│   │   ├── AdminLayout.jsx
│   │   ├── ClientPreviewLayout.jsx
│   │   └── layout.jsx
│   │
│   ├── pages/              # Páginas
│   │   ├── Login/
│   │   ├── RecuperarSenha/
│   │   ├── RedefinirSenha/
│   │   │
│   │   ├── paginasAdmin/   # Páginas admin
│   │   │   ├── agentesAdmin/
│   │   │   ├── auditAdmin/
│   │   │   ├── configAdmin/
│   │   │   ├── dashAdmin/
│   │   │   ├── docAdmin/
│   │   │   ├── empresasAdmin/
│   │   │   ├── inventarioAdmin/
│   │   │   ├── segurancaAdmin/
│   │   │   ├── snmp/
│   │   │   └── usuariosAdmin/
│   │   │
│   │   └── paginasClient/  # Páginas cliente
│   │       ├── ChamadosGLPI/
│   │       ├── Conta/
│   │       ├── Dashboard/
│   │       ├── Documentação/
│   │       ├── Microsoft/
│   │       ├── Rede/
│   │       ├── Segurança/
│   │       └── Servidores/
│   │
│   └── rotas/
│       └── rotas.jsx      # Definição de rotas
│
├── package.json
├── vite.config.js
└── tailwind.config.js
```

---

## 🔌 Conexões de Dados

```mermaid
graph LR
    subgraph Frontend
        A[React App]
    end
    
    subgraph Backend
        B[Fastify API]
        C[Services]
    end
    
    subgraph ExternalAPIs
        D[Zabbix]
        E[GLPI]
        F[MS Graph]
    end
    
    subgraph Database
        G[(Supabase)]
        H[(Storage)]
    end
    
    A -->|HTTP/WS| B
    B -->|REST| C
    C -->|Fetch| D
    C -->|Fetch| E
    C -->|Fetch| F
    C -->|Query| G
    C -->|Upload| H
```

---

## 🔐 Fluxo de Autenticação

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Frontend
    participant A as Auth API
    participant J as JWT
    participant DB as Supabase Auth
    
    U->>F: Login (email/senha)
    F->>A: POST /auth/login
    A->>DB: Verify Credentials
    DB-->>A: User Valid
    A->>J: Generate Token
    J-->>A: JWT Token
    A-->>F: { token, user }
    F->>F: Store in Context
    F-->>U: Redirect to Dashboard
    
    Note over U,DB: Token é usado em todas as requisições
    
    U->>F: Request Protected Resource
    F->>B: GET /api/resource (with JWT)
    B->>J: Verify Token
    J-->>B: Token Valid
    B-->>F: Resource Data
    F-->>U: Display Resource
```

---

## 🔄 Fluxo de Dados em Tempo Real

```mermaid
graph LR
    subgraph Source
        Z[Zabbix]
        G[GLPI]
        M[MS365]
    end
    
    subgraph Backend
        J[Cron Job]
        S[Services]
    end
    
    subgraph Database
        DB[(PostgreSQL)]
        RT[Realtime]
    end
    
    subgraph Client
        W[WebSocket]
        UI[React UI]
    end
    
    J -->|Scheduled| S
    S -->|Fetch| Z
    S -->|Fetch| G
    S -->|Fetch| M
    S -->|Update| DB
    DB -->|Trigger| RT
    RT -->|Broadcast| W
    W -->|Update| UI
```

---

## 📊 Componentes de Infraestrutura

| Componente | Tecnologia | Propósito |
|------------|------------|-----------|
| **API Server** | Fastify | REST API |
| **Database** | Supabase PostgreSQL | Persistência |
| **Realtime** | Supabase Realtime | WebSockets |
| **Storage** | Supabase Storage | Arquivos |
| **Auth** | Supabase Auth + JWT | Autenticação |
| **Proxy** | Nginx | Load balancing, SSL |
| **Workers** | Cron Jobs | Processamento agendado |

---

## 🔒 Arquitetura de Segurança

Consulte [[02-Arquitetura/Segurança]] para detalhes completos.

---

> **Última atualização:** 2026-08
