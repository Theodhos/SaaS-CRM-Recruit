# syntax=docker/dockerfile:1.7
#
# Production image for the NestJS API.
#   docker build -f infrastructure/docker/api.Dockerfile -t crm-api .            # runtime image
#   docker build -f infrastructure/docker/api.Dockerfile --target migrate -t crm-migrate .   # one-shot `prisma migrate deploy`
#
# The build context is the repo root. Nothing secret is copied in (see .dockerignore);
# configuration arrives as environment variables at runtime.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
ENV HUSKY=0 CI=true
# openssl: Prisma's query engine on Alpine (musl). tini: PID 1 that forwards SIGTERM so Nest's
# graceful-shutdown hooks run, and reaps zombie processes.
RUN apk add --no-cache openssl tini \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

# ---- 1) manifests only: dependency layers stay cached until a package.json / the lockfile changes
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

# ---- 2) full dependency set (dev tooling included) — used only to build
FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @crm/database db:generate \
 && pnpm --filter @crm/api build

# ---- 3) production dependencies of the API only (no eslint, jest, typescript, ...)
FROM manifests AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter "@crm/api..."

# ---- one-shot migration job: needs the Prisma CLI + schema, so it uses the full dependency set
FROM build AS migrate
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@crm/database", "db:migrate:deploy"]

# ---- runtime
FROM base AS runner
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=4000
COPY --from=prod-deps --chown=node:node /repo/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /repo/apps/api/node_modules ./apps/api/node_modules
# The generated Prisma client (with the Linux query engine) must sit at the same path it was generated at.
COPY --from=build --chown=node:node /repo/packages/database/src/generated ./packages/database/src/generated
COPY --from=build --chown=node:node /repo/apps/api/dist ./apps/api/dist
COPY --from=build --chown=node:node /repo/apps/api/package.json ./apps/api/package.json

USER node
EXPOSE 4000
# Liveness only (does the process answer?). Readiness — DB / Redis reachable — is /health/ready, used by the load balancer.
HEALTHCHECK --interval=15s --timeout=3s --start-period=40s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${API_PORT}/health" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/api/dist/main.js"]
