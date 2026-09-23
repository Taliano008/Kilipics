FROM node:20-slim AS base
WORKDIR /app
# uploadsDir in src/env.js resolves via process.cwd() + UPLOADS_DIR — this
# WORKDIR must match docker-compose.yml's uploads-data mount point (/app/uploads).
COPY package*.json ./
RUN npm ci --omit=dev

FROM base AS runtime
COPY . .
# Uploads directory must exist before the volume mount point is used
RUN mkdir -p uploads
EXPOSE 3000 3050
CMD ["node", "src/app.js"]
