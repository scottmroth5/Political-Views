#!/usr/bin/env bash
# One-time server setup for a fresh Lightsail Ubuntu 24.04 instance; safe to run again (it keeps
# existing certificates, .env and data). From the Lightsail browser SSH:
#
#   git clone https://github.com/scottmroth5/Political-Views.git ~/pv
#   sudo bash ~/pv/deploy/setup-server.sh "ssh-ed25519 AAAA... github-deploy"
#
# Re-run it after pulling repo changes to deploy/ (compose.yml, Caddyfile, scripts).
set -euo pipefail

[[ $EUID -eq 0 ]] || {
  echo "Run with sudo." >&2
  exit 1
}
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR=/opt/political-views
CERTS="$APP_DIR/certs"
DEPLOY_KEY="${1:-}"
say() { printf '\n== %s\n' "$*"; }

say "Packages and automatic security updates"
export DEBIAN_FRONTEND=noninteractive
apt-get update -q
apt-get upgrade -yq
apt-get install -yq --no-install-recommends docker.io docker-compose-v2 age fail2ban \
  unattended-upgrades openssl ca-certificates cron
systemctl enable --now docker fail2ban cron
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
cat >/etc/apt/apt.conf.d/52political-views-reboot <<'EOF'
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:30";
EOF

say "SSH: keys only, no root login"
cat >/etc/ssh/sshd_config.d/60-political-views.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
X11Forwarding no
EOF
sshd -t
systemctl reload ssh

say "deploy user"
id deploy >/dev/null 2>&1 || useradd --create-home --shell /bin/bash deploy
usermod -aG docker deploy

say "App directory $APP_DIR"
install -d -o root -g deploy -m 750 "$APP_DIR"
install -d -o deploy -g deploy -m 700 "$APP_DIR/state"
install -d -o root -g root -m 755 "$APP_DIR/postgres"
install -o root -g root -m 755 "$SRC/deploy.sh" "$SRC/backup.sh" "$APP_DIR/"
install -o root -g deploy -m 644 "$SRC/compose.yml" "$SRC/Caddyfile" "$APP_DIR/"
install -o root -g root -m 644 "$SRC/postgres/pg_hba.conf" "$APP_DIR/postgres/"
install -o root -g root -m 755 "$SRC/postgres/init-app-role.sh" "$APP_DIR/postgres/"

say "Database TLS certificates (own CA)"
install -d -o root -g root -m 755 "$CERTS"
if [[ ! -s "$CERTS/ca.crt" ]]; then
  work=$(mktemp -d)
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 3650 \
    -subj "/CN=political-views-db-ca" -keyout "$CERTS/ca.key" -out "$CERTS/ca.crt" 2>/dev/null
  openssl req -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -subj "/CN=db" \
    -keyout "$CERTS/server.key" -out "$work/server.csr" 2>/dev/null
  printf 'subjectAltName=DNS:db\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature\n' >"$work/ext"
  openssl x509 -req -in "$work/server.csr" -CA "$CERTS/ca.crt" -CAkey "$CERTS/ca.key" \
    -CAcreateserial -days 825 -sha256 -extfile "$work/ext" -out "$CERTS/server.crt" 2>/dev/null
  rm -rf "$work" "$CERTS/ca.srl"
  echo "created a new CA and server certificate (valid 825 days)"
fi
chmod 600 "$CERTS/ca.key"
chmod 644 "$CERTS/ca.crt" "$CERTS/server.crt"
# Postgres (alpine image, uid 70) must own its key, mode 600.
chown 70:70 "$CERTS/server.key"
chmod 600 "$CERTS/server.key"

say "Settings ($APP_DIR/.env)"
if [[ ! -f "$APP_DIR/.env" ]]; then
  sed -e "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 32)/" \
    -e "s/^APP_DB_PASSWORD=.*/APP_DB_PASSWORD=$(openssl rand -hex 32)/" \
    "$SRC/server.env.example" >"$APP_DIR/.env"
  echo "created .env with generated database passwords"
fi
chown root:deploy "$APP_DIR/.env"
chmod 640 "$APP_DIR/.env"

if [[ -n "$DEPLOY_KEY" ]]; then
  say "GitHub deploy key (forced command)"
  [[ "$DEPLOY_KEY" =~ ^ssh-ed25519\ [A-Za-z0-9+/]+=*( .*)?$ ]] || {
    echo "The deploy key must be one ssh-ed25519 public key line." >&2
    exit 1
  }
  install -d -o deploy -g deploy -m 700 /home/deploy/.ssh
  printf 'restrict,command="%s/deploy.sh" %s\n' "$APP_DIR" "$DEPLOY_KEY" >/home/deploy/.ssh/authorized_keys
  chown deploy:deploy /home/deploy/.ssh/authorized_keys
  chmod 600 /home/deploy/.ssh/authorized_keys
fi

say "Nightly jobs (UTC)"
cat >/etc/cron.d/political-views <<EOF
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 3 * * * deploy $APP_DIR/backup.sh >>$APP_DIR/state/backup.log 2>&1
45 3 * * * deploy $APP_DIR/deploy.sh purge >>$APP_DIR/state/purge.log 2>&1
EOF
chmod 644 /etc/cron.d/political-views

say "Done. Next steps"
cat <<EOF
1. Fill in the backup settings (AGE_RECIPIENT, BACKUP_*) and, optionally, ANALYTICS_TOKEN:
     sudo nano $APP_DIR/.env
2. Add this server's host key to GitHub as DEPLOY_KNOWN_HOSTS (run from your PC):
     ssh-keyscan -t ed25519 <static-ip>
3. In GitHub, set the variable DEPLOY_ENABLED=true and push to main (or run Deploy).
EOF
