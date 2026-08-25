FROM node:22-alpine AS base
WORKDIR /usr/src/app
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --prod

# Desarrollo
FROM node:22-alpine AS dev
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/node_modules ./node_modules
COPY . .
RUN corepack enable pnpm && pnpm add -g nodemon
EXPOSE 3000
CMD ["nodemon", "src/index.js"]

# Producción
FROM node:22-alpine AS prod
WORKDIR /usr/src/app
COPY --from=base /usr/src/app/node_modules ./node_modules
# Solo lo imprescindible en runtime: package.json ("type": "module", sin él
# Node no resuelve los ESM) y el código fuente. Nada de lockfiles, nginx/, etc.
COPY package.json ./
COPY src ./src
EXPOSE 3000
CMD ["node", "src/index.js"]
