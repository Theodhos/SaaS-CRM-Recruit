#!/usr/bin/env bash
# Post-deploy smoke test against a running stack (through the edge). Exits non-zero on the first failure.
#
#   ./infrastructure/scripts/smoke-test.sh https://app.example.com
#
# Optional authenticated check (a dedicated, low-privilege account — never a real user):
#   SMOKE_EMAIL=smoke@example.com SMOKE_PASSWORD=... ./infrastructure/scripts/smoke-test.sh https://app.example.com
set -euo pipefail

BASE="${1:?usage: smoke-test.sh <base-url>}"
BASE="${BASE%/}"
API_PREFIX="${API_PREFIX:-/api/v1}"
fail=0

check() { # name expected_status url [extra curl args...]
  local name="$1" want="$2" url="$3"; shift 3
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$@" "$url" || echo 000)"
  if [ "$got" = "$want" ]; then printf '  ok   %-38s %s\n' "$name" "$got"; else printf '  FAIL %-38s got %s, want %s\n' "$name" "$got" "$want"; fail=1; fi
}

echo "smoke test: $BASE"
check "edge liveness"              200 "$BASE/lb-health"
check "api liveness"               200 "$BASE/health"
check "api readiness (db, redis)"  200 "$BASE/health/ready"
check "web liveness"               200 "$BASE/login"
check "auth gate: no token -> 401" 401 "$BASE$API_PREFIX/candidates"
check "auth gate: bad token -> 401" 401 "$BASE$API_PREFIX/candidates" -H "Authorization: Bearer not-a-real-token"
check "unknown route -> 404"       404 "$BASE$API_PREFIX/this-route-does-not-exist"

# Security headers must survive the edge.
hdrs="$(curl -s -D - -o /dev/null --max-time 15 "$BASE$API_PREFIX/candidates" | tr -d '\r')"
for h in "x-content-type-options" "x-request-id"; do
  if printf '%s' "$hdrs" | grep -qi "^$h:"; then printf '  ok   %-38s present\n' "header $h"; else printf '  FAIL %-38s missing\n' "header $h"; fail=1; fi
done

if [ -n "${SMOKE_EMAIL:-}" ] && [ -n "${SMOKE_PASSWORD:-}" ]; then
  jar="$(mktemp)"; trap 'rm -f "$jar"' EXIT
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -c "$jar" -H 'Content-Type: application/json' \
    -d "{\"email\":\"$SMOKE_EMAIL\",\"password\":\"$SMOKE_PASSWORD\"}" "$BASE$API_PREFIX/auth/login" || echo 000)"
  if [ "$code" = "200" ] || [ "$code" = "201" ]; then
    printf '  ok   %-38s %s\n' "login" "$code"
    check "authenticated /auth/me" 200 "$BASE$API_PREFIX/auth/me" -b "$jar"
  else
    printf '  FAIL %-38s got %s\n' "login" "$code"; fail=1
  fi
fi

[ "$fail" -eq 0 ] && echo "smoke test PASSED" || { echo "smoke test FAILED"; exit 1; }
