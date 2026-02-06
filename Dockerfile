# Etapa base (instalación de dependencias)
# Se usa node:18-alpine por ser una imagen ligera y segura
FROM node:18-alpine AS base

WORKDIR /usr/src/app

# Copiamos solo package.json y package-lock.json para aprovechar la caché de capas de Docker
COPY package*.json ./

# Instalamos solo las dependencias de producción inicialmente
RUN npm install --production

# Etapa de desarrollo
# Esta etapa incluye herramientas adicionales y no optimiza el tamaño tanto como producción
FROM node:18-alpine AS dev

WORKDIR /usr/src/app

# Copiar node_modules instalados en la etapa base
COPY --from=base /usr/src/app/node_modules ./node_modules
# Copiar el resto del código del proyecto
COPY . .

# Instalar nodemon globalmente para permitir el reinicio automático tras cambios (hot reload)
RUN npm install -g nodemon

# El puerto en el que escuchará la aplicación
EXPOSE 3000

# Comando para iniciar la aplicación en desarrollo usando el punto de entrada correcto
CMD ["nodemon", "src/index.js"]

# Etapa de producción
# Optimizada para ejecución final
FROM node:18-alpine AS prod

WORKDIR /usr/src/app

# Copiar dependencias de producción desde la etapa base
COPY --from=base /usr/src/app/node_modules ./node_modules
# Copiar el código fuente
COPY . .

# Asegurar que el puerto esté expuesto
EXPOSE 3000

# Comando para iniciar la aplicación en producción
CMD ["node", "src/index.js"]
