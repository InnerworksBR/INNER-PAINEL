# ==========================
# 1. Estágio de Build
# ==========================
FROM node:20-alpine as builder

WORKDIR /app

# Copia pacotes e instala dependências
COPY package*.json ./
RUN npm ci

# Copia o resto do projeto (React/Vite)
COPY . .

# Variáveis de ambiente para o Build (Vite precisa delas no momento do build)
ARG VITE_API_URL
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY

ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Faz o build
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
