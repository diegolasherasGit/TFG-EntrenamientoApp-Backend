# Etapa base (instalación de dependencias)
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Copiamos solo package.json y package-lock.json para aprovechar cache
COPY package*.json ./

# Instalamos dependencias de producción
RUN npm install --production



# Etapa de desarrollo
FROM node:18-alpine AS dev

WORKDIR /usr/src/app

# Copiar node_modules instalados en base
COPY --from=base /usr/src/app/node_modules ./node_modules
# Copiar todo el código
COPY . .

# Instalar nodemon globalmente para hot reload
RUN npm install -g nodemon

# Exponer puerto
EXPOSE 3000

# CMD por defecto en desarrollo
CMD ["nodemon", "src/app.js"]



# Etapa de producción
FROM node:18-alpine AS prod

WORKDIR /usr/src/app

# Copiar node_modules instalados en base
COPY --from=base /usr/src/app/node_modules ./node_modules
# Copiar todo el código
COPY . .

EXPOSE 3000

# CMD por defecto en producción
CMD ["node", "src/app.js"]
