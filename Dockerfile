# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim

WORKDIR /app

COPY --chown=node:node . .

# The optional CA secret supports managed build environments without embedding
# their certificate in the image. Ordinary local builds need no secret.
RUN --mount=type=secret,id=proxy_ca,required=false \
    set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates openssl; \
    rm -rf /var/lib/apt/lists/*; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --include=dev --no-audit --no-fund --cache /tmp/npm-cache; \
    DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate; \
    rm -rf /tmp/npm-cache /root/.npm; \
    mkdir -p /app/uploads; \
    chown -R node:node /app/uploads

ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER node

CMD ["node", "server.js"]
