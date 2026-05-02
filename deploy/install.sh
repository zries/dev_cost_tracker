#!/usr/bin/env bash
# Installs devcost on a fresh Debian 12 LXC. Idempotent — safe to re-run.
#
# Usage (inside the LXC, as root):
#   curl -fsSL https://raw.githubusercontent.com/<you>/devcost/main/deploy/install.sh | bash
# or, if you've cloned the repo:
#   bash deploy/install.sh
#
# Environment overrides (all optional):
#   PORT=8080                            Port to expose (default 8080)
#   HOST=0.0.0.0                         Bind address (default 0.0.0.0)
#   REPO_URL=https://github.com/...      Git repo to clone (defaults to whatever this script lives in)
#   REPO_BRANCH=main                     Branch to deploy
#   APP_DIR=/opt/devcost                 Install location
#   DATA_DIR=/var/lib/devcost            SQLite + state location
#   ADMIN_USERNAME=admin
#   ADMIN_PASSWORD=admin
#   NODE_VERSION=20                      NodeSource major version

set -euo pipefail

PORT="${PORT:-8080}"
HOST="${HOST:-0.0.0.0}"
APP_DIR="${APP_DIR:-/opt/devcost}"
DATA_DIR="${DATA_DIR:-/var/lib/devcost}"
ETC_DIR="${ETC_DIR:-/etc/devcost}"
REPO_URL="${REPO_URL:-https://github.com/zries-prj/devcost.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
NODE_VERSION="${NODE_VERSION:-20}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"

if [[ $EUID -ne 0 ]]; then
	echo "This script must be run as root." >&2
	exit 1
fi

log() { printf '\033[1;34m[devcost]\033[0m %s\n' "$*"; }

log "Updating apt and installing base packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates git build-essential python3 sqlite3

if ! command -v node >/dev/null 2>&1 || [[ "$(node -v)" != v${NODE_VERSION}.* ]]; then
	log "Installing Node.js ${NODE_VERSION}.x via NodeSource…"
	curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
	apt-get install -y -qq nodejs
fi

if ! id devcost >/dev/null 2>&1; then
	log "Creating system user 'devcost'…"
	useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin devcost
fi

log "Preparing directories…"
mkdir -p "$APP_DIR" "$DATA_DIR" "$ETC_DIR"
chown -R devcost:devcost "$APP_DIR" "$DATA_DIR"
chmod 750 "$DATA_DIR"

if [[ -d "$APP_DIR/.git" ]]; then
	log "Updating existing checkout in $APP_DIR…"
	sudo -u devcost git -C "$APP_DIR" fetch --depth=1 origin "$REPO_BRANCH"
	sudo -u devcost git -C "$APP_DIR" checkout -B "$REPO_BRANCH" "origin/$REPO_BRANCH"
elif [[ -f "$(dirname "$0")/../package.json" ]]; then
	log "Copying local source into $APP_DIR…"
	rsync -a --delete --exclude node_modules --exclude build --exclude .git \
		"$(cd "$(dirname "$0")/.." && pwd)/" "$APP_DIR/"
	chown -R devcost:devcost "$APP_DIR"
else
	log "Cloning $REPO_URL ($REPO_BRANCH) into $APP_DIR…"
	sudo -u devcost git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "Installing npm dependencies (this builds better-sqlite3 from source — ~1 min)…"
sudo -u devcost --preserve-env=PATH bash -c "cd $APP_DIR && npm ci --no-audit --no-fund"

log "Building app…"
sudo -u devcost --preserve-env=PATH bash -c "cd $APP_DIR && npm run build"

if [[ ! -f "$ETC_DIR/devcost.env" ]]; then
	log "Writing initial config to $ETC_DIR/devcost.env…"
	SESSION_SECRET="$(openssl rand -hex 32 2>/dev/null || head -c 64 /dev/urandom | xxd -p -c 64)"
	cat > "$ETC_DIR/devcost.env" <<EOF
PORT=${PORT}
HOST=${HOST}
NODE_ENV=production
DATABASE_PATH=${DATA_DIR}/devcost.sqlite
SESSION_SECRET=${SESSION_SECRET}
ADMIN_USERNAME=${ADMIN_USERNAME}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
COOKIE_SECURE=false
EOF
	chmod 640 "$ETC_DIR/devcost.env"
	chown root:devcost "$ETC_DIR/devcost.env"
else
	log "Existing $ETC_DIR/devcost.env detected — leaving it alone. Edit it manually if you want to change PORT, etc."
fi

log "Installing systemd unit…"
install -m 0644 "$APP_DIR/deploy/devcost.service" /etc/systemd/system/devcost.service
systemctl daemon-reload
systemctl enable devcost.service
systemctl restart devcost.service

sleep 2
if systemctl is-active --quiet devcost.service; then
	IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
	log "devcost is running."
	log "Open: http://${IP:-<container-ip>}:${PORT}"
	log "Default login: ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}"
	log "Edit config:   $ETC_DIR/devcost.env  (then: systemctl restart devcost)"
	log "View logs:     journalctl -u devcost -f"
else
	echo "devcost failed to start. Check: journalctl -u devcost --no-pager -n 80" >&2
	exit 1
fi
