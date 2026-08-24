# 🛠️ Setup de Desenvolvimento

## Guia Completo de Configuração

Este guia explica como configurar o ambiente de desenvolvimento do Portal Inner.

---

## 📋 Pré-requisitos

### Software Necessário

| Software | Versão Mínima | Download |
|----------|---------------|----------|
| Node.js | 18.x LTS | [nodejs.org](https://nodejs.org) |
| npm | 9.x | (incluso no Node.js) |
| Git | 2.x | [git-scm.com](https://git-scm.com) |
| VS Code | Latest | [code.visualstudio.com](https://code.visualstudio.com) |
| Docker Desktop | Latest | [docker.com](https://docker.com) |

### Opcional

| Software | Uso |
|----------|-----|
| Supabase CLI | Desenvolvimento local |
| Docker Compose | Ambientes isolados |

---

## 🚀 Instalação Passo a Passo

### 1. Clonar o Repositório

```bash
git clone https://github.com/InnerworksBR/inner-painel.git
cd inner-painel
```

### 2. Configurar Variáveis de Ambiente

#### Backend

```bash
cd backend
cp .env.example .env
```

Edite o arquivo `.env`:

```env
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# JWT
JWT_SECRET=your-super-secret-jwt-key-at-least-32-chars

# Criptografia
ENCRYPTION_KEY=your-32-byte-hex-key-for-aes-256

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Server
PORT=3000
NODE_ENV=development

# Zabbix (opcional para dev)
ZABBIX_URL=https://zabbix.example.com
ZABBIX_USER=api_user
ZABBIX_PASSWORD=api_password

# GLPI (opcional para dev)
GLPI_URL=https://glpi.example.com
GLPI_APP_TOKEN=your-app-token
GLPI_USER_TOKEN=your-user-token

# MS365 (opcional para dev)
MS_TENANT_ID=your-tenant-id
MS_CLIENT_ID=your-client-id
MS_CLIENT_SECRET=your-client-secret
```

#### Frontend

```bash
cd web
cp .env.example .env
```

```env
# API
VITE_API_URL=http://localhost:3000/api

# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Instalar Dependências

```bash
# Backend
cd backend
npm install

# Frontend
cd web
npm install
```

### 4. Configurar Supabase Local (Opcional)

```bash
# Instalar CLI globalmente
npm install -g supabase

# Iniciar ambiente local
supabase init
supabase start

# Ver status
supabase status
```

### 5. Executar Migrações

```bash
cd backend

# Aplicar migrations
psql $SUPABASE_DB_URL < migrations/migration_001.sql
psql $SUPABASE_DB_URL < migrations/migration_002.sql
# ... continuar para todas
```

Ou usar o script:

```bash
npm run db:migrate
```

---

## 🏃 Executar o Projeto

### Modo Desenvolvimento

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

### URLs de Acesso

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3000 |
| API Docs (Swagger) | http://localhost:3000/docs |
| Supabase Studio | http://localhost:54323 |

---

## 🧪 Executar Testes

```bash
# Frontend
cd web
npm test

# Backend
cd backend
npm test

# Com coverage
npm run test:coverage
```

---

## 🔧 Configurações do VS Code

### Extensões Recomendadas

```json
// .vscode/extensions.json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "qcz.text-graphviz",
    "usernamehw.errorlens"
  ]
}
```

### Configurações

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## 🐳 Docker (Produção)

### Build Manual

```bash
# Backend
cd backend
docker build -t inner-backend:latest .
docker run -d -p 3000:3000 --env-file .env inner-backend:latest

# Frontend
cd web
docker build -t inner-frontend:latest .
docker run -d -p 80:80 inner-frontend:latest
```

### Docker Compose (Opcional)

```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    build: ./backend
    ports:
      - "3000:3000"
    env_file:
      - ./backend/.env

  frontend:
    build: ./web
    ports:
      - "80:80"
    depends_on:
      - backend
```

```bash
docker-compose up -d
```

---

## 🔍 Troubleshooting

### Problema: `EADDRINUSE`

```bash
# Encontrar processo usando a porta
# Windows
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Linux/Mac
lsof -i :3000
kill -9 <pid>
```

### Problema: `MODULE_NOT_FOUND`

```bash
# Limpar node_modules e reinstalar
rm -rf node_modules package-lock.json
npm install
```

### Problema: `Cannot connect to Supabase`

```bash
# Verificar configuração
cat backend/.env | grep SUPABASE

# Testar conexão
npx supabase status
```

---

## 📚 Recursos Adicionais

- [[02-Arquitetura/Diagrama-de-Arquitetura|Arquitetura do Sistema]]
- [[03-Backend/README|Backend]]
- [[04-Frontend/README|Frontend]]
- [[08-Guias/Deploy|Deploy]]

---

> **Última atualização:** 2026-08
