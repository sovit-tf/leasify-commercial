# Leasify Commercial: one always-on Node process (the engine lives in memory), Postgres for storage.
FROM node:22-slim

# python3 builds the browser page (web/build.py); curl is for the health check;
# fontconfig and a font are needed so the WhatsApp unit pictures can draw their text
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 curl ca-certificates fontconfig fonts-dejavu-core \
 && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production PORT=3000 TZ=Asia/Kolkata
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .
RUN python3 web/build.py --server && chown -R node:node /app

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT}/healthz || exit 1

CMD ["node", "server/index.js"]
