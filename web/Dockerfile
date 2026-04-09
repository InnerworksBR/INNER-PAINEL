# ==========================
# 1. Estágio de Build
# ==========================
FROM node:20-alpine as builder

WORKDIR /app

# Copia pacotes e instala dependências
COPY package*.json ./
RUN npm ci

# Copia o resto do projeto (React/Vite) e faz o build
COPY . .
RUN npm run build

# ==========================
# 2. Estágio de Produção (Nginx)
# ==========================
FROM nginx:alpine

# Remove o arquivo default do Nginx
RUN rm /etc/nginx/conf.d/default.conf

# Adiciona a configuração personalizada para SPA (Single Page Application)
COPY nginx.conf /etc/nginx/conf.d/

# Copia os arquivos gerados (pasta dist do Vite)
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
