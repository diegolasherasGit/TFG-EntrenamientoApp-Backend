FROM node:18-alpine AS base
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production

# Desarrollo
FROM node:18-alpine AS dev
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY . .
RUN npm install -g nodemon
EXPOSE 3000
CMD ["nodemon", "src/index.js"]

# Producción
FROM node:18-alpine AS prod
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "src/index.js"]
