#!/usr/bin/env bash
# Zero-downtime (blue/green) release on a compose host.
#
#   TAG=1.4.0 REGISTRY=ghcr.io/acme/crm ./infrastructure/scripts/deploy.sh
#
# Flow
#   1. apply database migrations (expand-only — see docs/operations/deployment.md)
#   2. start the IDLE colour with the new image tag and wait until it is healthy AND ready
#   3. smoke-test the idle colour through the edge's internal network
#   4. flip the edge (`active-color.conf`) and reload nginx gracefully — in-flight requests finish
#   5. replace workers / realtime in place (they are not user-facing)
#   6. keep the previous colour running for a grace period so `rollback.sh` is instant, then stop it
#
# Any failure before step 4 leaves production untouched. A failure after it triggers an automatic rollback.
set -euo pipefail

cd "$(dirname "$0")/../.."
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
ACTIVE_FILE=infrastructure/nginx/active-color.conf
: "${TAG:?set TAG to the image tag to deploy (e.g. a git sha or semver)}"
GRACE_SECONDS="${GRACE_SECONDS:-300}"
READY_TIMEOUT="${READY_TIMEOUT:-180}"

log() { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[deploy] %s\033[0m\n' "$*" >&2; exit 1; }

current_color() { sed -n 's/^set \$active_color \([a-z]*\);.*/\1/p' "$ACTIVE_FILE"; }
other_color()   { [ "$1" = blue ] && echo green || echo blue; }

write_active() { # $1 = color
  cat > "$ACTIVE_FILE" <<EOF
# Which colour (blue | green) the edge sends traffic to. Rewritten by infrastructure/scripts/deploy.sh and
# rollback.sh, followed by a graceful \`nginx -s reload\` (no dropped connections). Included inside \`server {}\`.
set \$active_color $1;
set \$api_host     api-$1;
set \$web_host     web-$1;
EOF
}

reload_edge() {
  "${COMPOSE[@]}" exec -T edge nginx -t >/dev/null || die "nginx config test failed; not reloading"
  "${COMPOSE[@]}" exec -T edge nginx -s reload
}

wait_ready() { # $1 = color: /health/ready of an api replica, reached over the compose network
  local color="$1" deadline=$((SECONDS + READY_TIMEOUT))
  until "${COMPOSE[@]}" exec -T edge wget -q -O /dev/null "http://api-${color}:4000/health/ready" 2>/dev/null \
     && "${COMPOSE[@]}" exec -T edge wget -q -O /dev/null "http://web-${color}:3000/healthz" 2>/dev/null; do
    [ "$SECONDS" -lt "$deadline" ] || return 1
    sleep 3
  done
}

ACTIVE="$(current_color)"; [ -n "$ACTIVE" ] || die "cannot read the active colour from $ACTIVE_FILE"
IDLE="$(other_color "$ACTIVE")"
log "active=$ACTIVE  idle=$IDLE  tag=$TAG"

log "1/6 migrations (expand-only)"
MIGRATE_TAG="$TAG" "${COMPOSE[@]}" --profile migrate run --rm migrate

log "2/6 starting $IDLE with tag $TAG"
export "$(printf '%s_TAG' "${IDLE^^}")=$TAG"
"${COMPOSE[@]}" --profile "$IDLE" up -d --no-deps --wait "api-$IDLE" "web-$IDLE" \
  || die "$IDLE did not become healthy; $ACTIVE is still serving. Inspect: docker compose logs api-$IDLE"
wait_ready "$IDLE" || { "${COMPOSE[@]}" --profile "$IDLE" stop "api-$IDLE" "web-$IDLE"; die "$IDLE not ready within ${READY_TIMEOUT}s; $ACTIVE is still serving"; }

log "3/6 smoke test against $IDLE"
"${COMPOSE[@]}" exec -T -e "UPSTREAM_API=http://api-${IDLE}:4000" -e "UPSTREAM_WEB=http://web-${IDLE}:3000" edge \
  sh -c 'wget -q -O /dev/null "$UPSTREAM_API/health/ready" && wget -q -O /dev/null "$UPSTREAM_WEB/healthz" && wget -q -O /dev/null "$UPSTREAM_WEB/login"' \
  || { "${COMPOSE[@]}" --profile "$IDLE" stop "api-$IDLE" "web-$IDLE"; die "smoke test failed; $ACTIVE is still serving"; }

log "4/6 flipping the edge to $IDLE"
cp "$ACTIVE_FILE" "$ACTIVE_FILE.prev"
write_active "$IDLE"
if ! reload_edge; then cp "$ACTIVE_FILE.prev" "$ACTIVE_FILE"; die "edge reload failed; restored $ACTIVE"; fi

log "post-flip check through the edge"
if ! infrastructure/scripts/smoke-test.sh "${SMOKE_BASE_URL:-http://127.0.0.1:${EDGE_PORT:-80}}"; then
  log "post-flip smoke test FAILED — rolling back to $ACTIVE"
  cp "$ACTIVE_FILE.prev" "$ACTIVE_FILE"; reload_edge
  die "rolled back to $ACTIVE"
fi

log "5/6 replacing workers and realtime in place"
WORKER_TAG="$TAG" "${COMPOSE[@]}" up -d --no-deps worker realtime

log "6/6 keeping $ACTIVE for ${GRACE_SECONDS}s (instant rollback window), then stopping it"
sleep "$GRACE_SECONDS"
"${COMPOSE[@]}" --profile "$ACTIVE" stop "api-$ACTIVE" "web-$ACTIVE"
printf '%s\n' "$TAG" > .deployed-tag
log "done: $IDLE is live on $TAG. Roll back with: infrastructure/scripts/rollback.sh"
