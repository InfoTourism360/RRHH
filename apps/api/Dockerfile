# --- Build: compila TypeScript a JS y copia las migraciones SQL ---
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY . .
RUN npm run build -w @rrhh/api \
 && cp -r apps/api/src/migrations apps/api/dist/migrations

# --- Runtime: solo lo necesario para ejecutar ---
FROM node:22-slim AS run
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/server.js"]
