#!/usr/bin/env bash
# Instant rollback to the previous colour: start it (its containers still exist), wait until it is ready,
# flip the edge back and reload. No image pull, no rebuild — typically a few seconds.
#
#   ./infrastructure/scripts/rollback.sh
#
# Database note: migrations are expand-only, so the previous application version still works against the
# current schema. Never roll back a DESTRUCTIVE migration this way — see docs/operations/deployment.md.
set -euo pipefail

cd "$(dirname "$0")/../.."
COMPOSE=(docker compose --env-file .env.production -f docker-compose.prod.yml)
ACTIVE_FILE=infrastructure/nginx/active-color.conf
READY_TIMEOUT="${READY_TIMEOUT:-120}"

log() { printf '\033[1;33m[rollback]\033[0m %s\n' "$*"; }
die() { printf '\033[1;31m[rollback] %s\033[0m\n' "$*" >&2; exit 1; }

ACTIVE="$(sed -n 's/^set \$active_color \([a-z]*\);.*/\1/p' "$ACTIVE_FILE")"
[ -n "$ACTIVE" ] || die "cannot read the active colour from $ACTIVE_FILE"
TARGET=$([ "$ACTIVE" = blue ] && echo green || echo blue)
log "active=$ACTIVE  rolling back to $TARGET"

"${COMPOSE[@]}" --profile "$TARGET" up -d --no-deps --wait "api-$TARGET" "web-$TARGET" \
  || die "$TARGET did not start; $ACTIVE keeps serving"

deadline=$((SECONDS + READY_TIMEOUT))
until "${COMPOSE[@]}" exec -T edge wget -q -O /dev/null "http://api-${TARGET}:4000/health/ready" 2>/dev/null; do
  [ "$SECONDS" -lt "$deadline" ] || die "$TARGET not ready within ${READY_TIMEOUT}s; $ACTIVE keeps serving"
  sleep 2
done

cat > "$ACTIVE_FILE" <<EOF
# Which colour (blue | green) the edge sends traffic to. Rewritten by infrastructure/scripts/deploy.sh and
# rollback.sh, followed by a graceful \`nginx -s reload\` (no dropped connections). Included inside \`server {}\`.
set \$active_color $TARGET;
set \$api_host     api-$TARGET;
set \$web_host     web-$TARGET;
EOF
"${COMPOSE[@]}" exec -T edge nginx -t >/dev/null || die "nginx config test failed"
"${COMPOSE[@]}" exec -T edge nginx -s reload
log "edge now serves $TARGET. Stopping the faulty colour $ACTIVE."
"${COMPOSE[@]}" --profile "$ACTIVE" stop "api-$ACTIVE" "web-$ACTIVE"
log "rolled back. Investigate with: docker compose -f docker-compose.prod.yml logs api-$ACTIVE"
