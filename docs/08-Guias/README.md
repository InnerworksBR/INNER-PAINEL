# 🛠️ Guias

## Índice de Guias

Coleção de guias práticos para desenvolvimento, deploy e manutenção do Portal Inner.

---

## 📑 Guias Disponíveis

| Guia | Descrição |
|------|-----------|
| [[Setup\|Setup de Desenvolvimento]] | Como configurar o ambiente local |
| [[Deploy\|Deploy]] | Processo de deploy em produção |
| [[Testes\|Testes]] | Como executar e criar testes |
| [[API-Local\|API Local]] | Configurar Supabase local |
| [[Troubleshooting\|Troubleshooting]] | Problemas comuns e soluções |

---

## 🔧 Setup de Desenvolvimento

### Pré-requisitos

```
- Node.js 18+
- npm 9+ ou yarn
- Git
- Docker (opcional, para Supabase local)
- VS Code (recomendado)
```

### 1. Clonar o Repositório

```bash
git clone https://github.com/InnerworksBR/inner-painel.git
cd inner-painel
```

### 2. Configurar Variáveis de Ambiente

```bash
# Backend
cd backend
cp .env.example .env
# Editar .env com suas configurações

# Frontend  
cd ../web
cp .env.example .env
# Editar .env com suas configurações
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
# Instalar Supabase CLI
npm install -g supabase

# Iniciar Supabase local
supabase init
supabase start
```

### 5. Executar o Projeto

```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

### 6. Acessar

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:3000
- **API Docs:** http://localhost:3000/docs (Swagger)

---

## 🚀 Deploy

### Deploy Rápido (PowerShell)

```powershell
# Deploy rápido
./deploy-quick.ps1
```

### Deploy Manual

#### Backend

```bash
# Build Docker
cd backend
docker build -t inner-backend:latest .
docker run -d -p 3000:3000 --env-file .env inner-backend:latest
```

#### Frontend

```bash
# Build
cd web
npm run build

# O output fica em web/dist/
# Deploy para Nginx
```

### Configuração Nginx

```nginx
server {
    listen 80;
    server_name painel.innertech.com.br;
    
    # Frontend
    location / {
        root /var/www/painel/dist;
        try_files $uri $uri/ /index.html;
    }
    
    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 🧪 Testes

### Executar Testes

```bash
# Frontend
cd web
npm test

# Backend
cd backend
npm test
```

### Criar Novo Teste

```bash
# Frontend - usando Vitest
cd web
# Criar arquivo: src/pages/paginasClient/Conta/conta.test.jsx

npm test -- --watch
```

### Cobertura de Testes

```bash
# Gerar relatório de cobertura
npm run test -- --coverage
```

---

## 🔍 Troubleshooting

### Problemas Comuns

#### `Cannot connect to database`

```bash
# Verificar Supabase
supabase status

# Verificar variável SUPABASE_URL
cat backend/.env | grep SUPABASE
```

#### `CORS error`

```typescript
// Verificar configuração em backend/src/plugins/cors.ts
const corsConfig = {
  origin: process.env.ALLOWED_ORIGINS?.split(','),
  credentials: true
};
```

#### `Token expired`

```javascript
// No frontend, verificar AuthContext
const logout = () => {
  localStorage.removeItem('token');
  window.location.href = '/login';
};
```

---

## 📞 Suporte

- **Email:** suporte@innertech.com.br
- **Slack:** #portal-inner-support
- **Docs:** Este vault

---

> **Última atualização:** 2026-08
