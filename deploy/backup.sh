#!/usr/bin/env bash
# Encrypted database backup to the Lightsail bucket (cron nightly, and before every deploy).
# The dump is encrypted with age to AGE_RECIPIENT (a public key) before it is written anywhere, so
# only the private key in the owner's password manager can read it; not even this server can.
# Backups older than BACKUP_KEEP_DAYS are deleted from the bucket.
set -euo pipefail
umask 077

APP_DIR=/opt/political-views
AWS_CLI_IMAGE=amazon/aws-cli:2.38.6

log() { printf '%s backup: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
fail() {
  log "FAILED: $*"
  exit 1
}

cd "$APP_DIR"
set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a
: "${AGE_RECIPIENT:?AGE_RECIPIENT is not set in .env}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is not set in .env}"
: "${BACKUP_ACCESS_KEY_ID:?BACKUP_ACCESS_KEY_ID is not set in .env}"
: "${BACKUP_SECRET_ACCESS_KEY:?BACKUP_SECRET_ACCESS_KEY is not set in .env}"
[[ "$AGE_RECIPIENT" == age1* ]] || fail "AGE_RECIPIENT must be an age public key (age1...)."
REGION="${BACKUP_REGION:-us-east-2}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
name="political-views-$(date -u +%Y%m%dT%H%M%SZ).dump.age"

docker compose --project-directory "$APP_DIR" -f "$APP_DIR/compose.yml" exec -T -u postgres db \
  pg_dump -U postgres -Fc political_views | age -r "$AGE_RECIPIENT" -o "$work/$name"
[[ -s "$work/$name" ]] || fail "The encrypted dump is empty."

# Credentials go to the AWS CLI container through a private env file, not the command line.
printf 'AWS_ACCESS_KEY_ID=%s\nAWS_SECRET_ACCESS_KEY=%s\nAWS_DEFAULT_REGION=%s\n' \
  "$BACKUP_ACCESS_KEY_ID" "$BACKUP_SECRET_ACCESS_KEY" "$REGION" >"$work/aws.env"
aws() { docker run --rm --env-file "$work/aws.env" -v "$work:/backup:ro" "$AWS_CLI_IMAGE" "$@"; }

aws s3 cp "/backup/$name" "s3://$BACKUP_BUCKET/backups/$name" --only-show-errors \
  || fail "Upload failed."
log "uploaded $name ($(stat -c %s "$work/$name") bytes)"

cutoff=$(date -u -d "$KEEP_DAYS days ago" +%Y%m%d)
aws s3 ls "s3://$BACKUP_BUCKET/backups/" | awk '{print $4}' | while read -r old; do
  [[ "$old" =~ ^political-views-([0-9]{8})T[0-9]{6}Z\.dump\.age$ ]] || continue
  if [[ "${BASH_REMATCH[1]}" < "$cutoff" ]]; then
    aws s3 rm "s3://$BACKUP_BUCKET/backups/$old" --only-show-errors && log "deleted old $old"
  fi
done
