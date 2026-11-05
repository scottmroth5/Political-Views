# Political Views server image: Node 22 and the built app. Holds code only; settings and secrets
# come from the server's environment at run time and data lives in Postgres (deploy/compose.yml).
#
#   docker build -t political-views .
#
# Stages: deps (npm ci) -> build (next build + bundled scripts) -> tools (Prisma CLI for
# migrations) -> runtime (standalone server, non-root, no npm).

FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY scripts/install-hooks.mjs ./scripts/install-hooks.mjs
# postinstall generates the Prisma client for this platform (Debian, OpenSSL 3).
RUN npm ci --no-audit --no-fund && rm -rf /root/.npm

FROM deps AS build
COPY . .
RUN npm run build && npm run build:scripts

# The Prisma CLI (same version as package.json) for `migrate deploy`, kept apart from the app.
FROM base AS tools
WORKDIR /tools
COPY package.json /tmp/package.json
RUN npm init -y >/dev/null \
 && npm install --no-audit --no-fund --save-exact \
      "prisma@$(node -p "require('/tmp/package.json').devDependencies.prisma")" \
 && rm -rf /root/.npm

FROM node:22-bookworm-slim AS runtime
# Debian security updates on top of the base image; npm, npx, corepack and yarn removed (the server
# only runs node, and they carry their own dependencies and vulnerabilities).
RUN apt-get update \
 && apt-get upgrade -y --no-install-recommends \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
           /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 HOSTNAME=127.0.0.1 PORT=3000
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma/schema.prisma ./prisma/schema.prisma
COPY --from=build /app/prisma/migrations ./prisma/migrations
COPY --from=build /app/dist-scripts ./dist-scripts
COPY --from=tools /tools/node_modules ./tools/node_modules
RUN mkdir -p /app/.next/cache && chown node:node /app/.next/cache
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
