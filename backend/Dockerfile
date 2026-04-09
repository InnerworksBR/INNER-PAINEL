# Usa a imagem do Node.js (versão 20 Alpine para ser mais leve)
FROM node:20-alpine

# Define o diretório de trabalho padrão dentro do container
WORKDIR /app

# Copia os arquivos de configuração de dependências
COPY package*.json ./

# Instala todas as dependências (necessário Typescript e tsx para rodar o npm start)
RUN npm ci

# Copia o restante do código
COPY . .

# Expõe a porta padrão do servidor Fastify
EXPOSE 3001

# Comando para rodar a aplicação
CMD ["npm", "start"]
