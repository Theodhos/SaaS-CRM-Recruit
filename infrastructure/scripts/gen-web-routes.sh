#!/usr/bin/env bash
# One-time generator for apps/web/app route placeholders. Re-run-safe: it
# only ever (re)writes the minimal page.tsx placeholder for each route this
# phase establishes — real page implementations replace these in Phase 2.
set -euo pipefail

APP_DIR="apps/web/app"

AUTH_ROUTES="login register forgot-password reset-password"
DASHBOARD_ROUTES="dashboard candidates companies contacts jobs applications pipeline activities tasks calendar emails documents placements fees retainers renewals talent-pools distribution-lists reports analytics users teams roles settings notifications"

to_title() {
  echo "$1" | sed -r 's/(^|-)([a-z])/\1\U\2/g' | sed 's/-/ /g'
}

to_pascal() {
  echo "$1" | sed -r 's/(^|-)([a-z])/\U\2/g'
}

for route in $AUTH_ROUTES; do
  dir="$APP_DIR/(auth)/$route"
  mkdir -p "$dir"
  title=$(to_title "$route")
  pascal=$(to_pascal "$route")
  cat > "$dir/page.tsx" <<EOF
export default function ${pascal}Page() {
  return (
    <div>
      <h1>$title</h1>
    </div>
  );
}
EOF
done

for route in $DASHBOARD_ROUTES; do
  dir="$APP_DIR/(dashboard)/$route"
  mkdir -p "$dir"
  title=$(to_title "$route")
  pascal=$(to_pascal "$route")
  cat > "$dir/page.tsx" <<EOF
export default function ${pascal}Page() {
  return (
    <div>
      <h1>$title</h1>
    </div>
  );
}
EOF
done

echo "web routes generated"
