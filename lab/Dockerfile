# Образ сайта «Лаборатория педагогических технологий».
# Сборка: docker compose build (см. deploy/README.md)

# Полный образ Debian: в нём уже есть OpenSSL, который нужен движку Prisma
FROM node:22-bookworm AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/app/storage/uploads
COPY --from=build /app /app
RUN mkdir -p /app/storage/uploads && chown -R node:node /app/storage \
    && chmod +x /app/deploy/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/robots.txt').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/deploy/docker-entrypoint.sh"]
