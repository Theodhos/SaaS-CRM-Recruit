# syntax=docker/dockerfile:1.7
#
# Production image for the Next.js web app (standalone output). Build context = repo root:
#   docker build -f infrastructure/docker/web.Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://app.example.com/api/v1 \
#     --build-arg NEXT_PUBLIC_REALTIME_URL=https://app.example.com \
#     -t crm-web .
#
# NEXT_PUBLIC_* values are inlined into the browser bundle at BUILD time, so they must be passed as
# build args — setting them only at container runtime has no effect on the client code.

ARG NODE_VERSION=20

FROM node:${NODE_VERSION}-alpine AS base
ENV HUSKY=0 CI=true NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache libc6-compat openssl tini \
 && corepack enable \
 && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS manifests
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
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
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_REALTIME_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_REALTIME_URL=${NEXT_PUBLIC_REALTIME_URL}
COPY . .
RUN pnpm --filter @crm/database db:generate \
 && pnpm --filter @crm/web build

FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Next's standalone output is self-contained (traced node_modules included); static assets and public/ sit beside it.
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=node:node /repo/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=3s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/healthz" || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "apps/web/server.js"]
