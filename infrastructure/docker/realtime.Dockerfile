# syntax=docker/dockerfile:1.7
#
# Production image for the Socket.IO realtime gateway. Build context = repo root:
#   docker build -f infrastructure/docker/realtime.Dockerfile -t crm-realtime .

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
ENV HUSKY=0 CI=true
RUN apk add --no-cache openssl tini \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/realtime/package.json apps/realtime/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/logger/package.json packages/logger/package.json
COPY packages/storage/package.json packages/storage/package.json
COPY packages/types/package.json packages/types/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/utils/package.json packages/utils/package.json
COPY packages/validation/package.json packages/validation/package.json

FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/database db:generate \
 && pnpm --filter @crm/realtime build

FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@crm/realtime..."

FROM base AS runner
ENV NODE_ENV=production \
    REALTIME_PORT=4001
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/realtime/node_modules ./apps/realtime/node_modules
COPY --from=build --chown=node:node /repo/apps/realtime/dist ./apps/realtime/dist
COPY --from=build --chown=node:node /repo/apps/realtime/package.json ./apps/realtime/package.json

USER node
EXPOSE 4001
HEALTHCHECK --interval=15s --timeout=3s --start-period=20s --retries=3 \
  CMD node -e "require('net').connect(${REALTIME_PORT:-4001},'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/realtime/dist/main.js"]
