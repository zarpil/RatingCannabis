# Etapa 1: Construir la aplicación (Frontend)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Etapa 2: Ejecutar el servidor Node (Backend + Frontend estático)
FROM node:20-alpine
WORKDIR /app

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm install --production

# Copiar archivos necesarios
COPY --from=builder /app/dist ./dist
COPY server.js ./

# La API Key se inyectará en tiempo de ejecución (runtime) desde Docker Compose o el entorno
ENV NODE_ENV=production

EXPOSE 80

CMD ["node", "server.js"]
