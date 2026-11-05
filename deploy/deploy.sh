#!/usr/bin/env bash
# The only command the GitHub deploy key can run (authorized_keys: restrict,command="…/deploy.sh").
# Root-owned, so the deploy user cannot change it.
#
#   deploy <tag>   pull the image, back up, migrate, start, health-check; on failure put things back
#   rollback       start the previous good image again (no migrations)
#   seed           load the question taxonomy with the current image (after editorial review)
#   purge          delete expired anonymous sessions (cron, daily)
#   status         current/previous tags and app health
#
# Tags look like sha-1a2b3c4 or sha-1a2b3c4-20261109 (weekly rebuild). Words come from
# SSH_ORIGINAL_COMMAND when called over SSH, else from the command line. No shell expansion of
# anything the client sent.
set -euo pipefail
umask 077

APP_DIR=/opt/political-views
STATE="$APP_DIR/state"
LOG="$STATE/deploy.log"
TAG_RE='^sha-[0-9a-f]{7}(-[0-9]{8})?$'

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" | tee -a "$LOG" >&2; }
fail() {
  log "FAILED: $*"
  exit 1
}

if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
  read -r -a WORDS <<<"$SSH_ORIGINAL_COMMAND"
else
  WORDS=("$@")
fi
ACTION="${WORDS[0]:-}"
TAG="${WORDS[1]:-}"
((${#WORDS[@]} <= 2)) || fail "Too many arguments."

cd "$APP_DIR"
mkdir -p "$STATE"
exec 9>"$STATE/lock"
flock -n 9 || fail "Another deploy is running."

current_tag() { cat "$STATE/current-tag" 2>/dev/null || true; }
previous_tag() { cat "$STATE/previous-tag" 2>/dev/null || true; }

compose() { IMAGE_TAG="${RUN_TAG:-$(current_tag)}" docker compose --project-directory "$APP_DIR" -f "$APP_DIR/compose.yml" "$@"; }

db_up() {
  compose up -d db >/dev/null
  for _ in $(seq 1 60); do
    if compose exec -T -u postgres db pg_isready -U postgres -d political_views >/dev/null 2>&1; then return 0; fi
    sleep 2
  done
  fail "Database did not become ready."
}

applied_migrations() {
  compose exec -T -u postgres db psql -U postgres -d political_views -tAc \
    "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL" 2>/dev/null || echo 0
}

prisma() { RUN_TAG="$1" compose run --rm --no-deps -T app node tools/node_modules/prisma/build/index.js "${@:2}" --schema prisma/schema.prisma; }

start_app() {
  RUN_TAG="$1" compose up -d --no-deps app
  # Caddy lives in the app container's network namespace, so it follows the app container.
  RUN_TAG="$1" compose up -d --no-deps --force-recreate caddy
}

wait_healthy() {
  local id status
  for _ in $(seq 1 60); do
    id=$(compose ps -q app 2>/dev/null || true)
    status=$(docker inspect -f '{{.State.Health.Status}}' "$id" 2>/dev/null || echo none)
    [[ "$status" == healthy ]] && return 0
    sleep 2
  done
  return 1
}

restore_dump() {
  log "Restoring the pre-deploy database copy"
  compose exec -T -u postgres db pg_restore -U postgres -d political_views --clean --if-exists --single-transaction <"$1"
}

deploy() {
  [[ "$TAG" =~ $TAG_RE ]] || fail "Unknown tag \"$TAG\"."
  local prev dump before after
  prev=$(current_tag)
  log "Deploying $TAG (current: ${prev:-none})"
  RUN_TAG="$TAG" compose pull -q app || fail "Could not pull $TAG."
  db_up

  if [[ -n "$prev" ]]; then
    "$APP_DIR/backup.sh" || fail "The encrypted backup failed, so $TAG was not started and nothing changed."
  fi
  dump="$STATE/pre-deploy.dump"
  compose exec -T -u postgres db pg_dump -U postgres -Fc political_views >"$dump" || fail "Could not copy the database."

  before=$(applied_migrations)
  if ! prisma "$TAG" migrate deploy; then
    after=$(applied_migrations)
    [[ "$after" == "$before" ]] || restore_dump "$dump" || true
    fail "Migrations failed; $TAG not started, ${prev:-nothing} still running."
  fi
  after=$(applied_migrations)

  start_app "$TAG"
  if wait_healthy; then
    [[ -n "$prev" && "$prev" != "$TAG" ]] && echo "$prev" >"$STATE/previous-tag"
    echo "$TAG" >"$STATE/current-tag"
    rm -f "$dump"
    log "Deployed $TAG ($before -> $after migrations applied)"
    return 0
  fi

  log "$TAG did not become healthy"
  if [[ "$after" != "$before" ]]; then restore_dump "$dump" || log "Restore failed; the copy is kept at $dump"; fi
  if [[ -n "$prev" ]]; then
    start_app "$prev"
    wait_healthy || log "The previous image $prev is not healthy either"
  fi
  fail "$TAG was rolled back to ${prev:-nothing}."
}

rollback() {
  local prev cur
  prev=$(previous_tag)
  cur=$(current_tag)
  [[ "$prev" =~ $TAG_RE ]] || fail "No previous image to roll back to."
  log "Rolling back from ${cur:-none} to $prev"
  start_app "$prev"
  wait_healthy || fail "$prev did not become healthy."
  echo "$cur" >"$STATE/previous-tag"
  echo "$prev" >"$STATE/current-tag"
  log "Rolled back to $prev"
}

case "$ACTION" in
  deploy) deploy ;;
  rollback) rollback ;;
  seed)
    [[ -n "$(current_tag)" ]] || fail "Deploy an image first."
    compose run --rm --no-deps -T app node dist-scripts/prisma/seed.js
    ;;
  purge) compose exec -T app node dist-scripts/scripts/purge-expired-sessions.js ;;
  status)
    echo "current:  $(current_tag)"
    echo "previous: $(previous_tag)"
    if wait_healthy; then echo "app: healthy"; else echo "app: NOT healthy"; fi
    ;;
  *) fail "Unknown command \"$ACTION\". Use deploy <tag>, rollback, seed, purge or status." ;;
esac
