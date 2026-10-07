# syntax=docker/dockerfile:1.7
#
# Production image for the background worker (BullMQ processors). Build context = repo root:
#   docker build -f infrastructure/docker/worker.Dockerfile -t crm-worker .
# Scale it independently of the API:  docker compose up -d --scale worker=3

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
 && pnpm --filter @crm/worker build

FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@crm/worker..."

FROM base AS runner
ENV NODE_ENV=production
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=node:node /repo/packages/database/src/generated ./packages/database/src/generated
COPY --from=build --chown=node:node /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=node:node /repo/apps/worker/package.json ./apps/worker/package.json

USER node
# The worker has no HTTP port. It exposes its own health through the process: if it cannot stay up, the
# orchestrator restarts it. tini forwards SIGTERM so in-flight jobs finish (see main.ts `shutdown`).
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/worker/dist/main.js"]
