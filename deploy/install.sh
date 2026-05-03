#!/usr/bin/env bash
# Installs devcost on a fresh Debian 12 LXC. Idempotent — safe to re-run.
#
# Usage (inside the LXC, as root):
#   curl -fsSL https://raw.githubusercontent.com/<you>/devcost/main/deploy/install.sh | bash
# or, if you've cloned the repo:
#   bash deploy/install.sh
#
# Environment overrides (all optional):
#   PORT=6767                            Port to expose (default 6767)
#   HOST=0.0.0.0                         Bind address (default 0.0.0.0)
#   REPO_URL=https://github.com/...      Git repo to clone (defaults to whatever this script lives in)
#   REPO_BRANCH=main                     Branch to deploy
#   APP_DIR=/opt/devcost                 Install location
#   DATA_DIR=/var/lib/devcost            SQLite + state location
#   ADMIN_USERNAME=admin
#   ADMIN_PASSWORD=admin
#   NODE_VERSION=20                      NodeSource major version
#   BACKUP_KEEP_DAYS=14                  How many daily SQLite backups to retain (0 disables backups)
#   BACKUP_HOUR=3                        Hour-of-day for the backup cron (0-23)
#   UPDATER_MODE=display                 'display' (default) shows update command in UI;
#                                        'oneclick' enables an in-browser "Update now" button.
#                                        Setting 'oneclick' installs sudo + a sudoers rule
#                                        allowing the devcost user to run /usr/local/sbin/devcost-update.

set -euo pipefail

PORT="${PORT:-6767}"
HOST="${HOST:-0.0.0.0}"
APP_DIR="${APP_DIR:-/opt/devcost}"
DATA_DIR="${DATA_DIR:-/var/lib/devcost}"
ETC_DIR="${ETC_DIR:-/etc/devcost}"
REPO_URL="${REPO_URL:-https://github.com/zries/dev_cost_tracker.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
NODE_VERSION="${NODE_VERSION:-20}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
BACKUP_HOUR="${BACKUP_HOUR:-3}"
UPDATER_MODE="${UPDATER_MODE:-display}"
case "$UPDATER_MODE" in display|oneclick) ;; *) echo "UPDATER_MODE must be 'display' or 'oneclick' (got: $UPDATER_MODE)" >&2; exit 2 ;; esac

if [[ $EUID -ne 0 ]]; then
	echo "This script must be run as root." >&2
	exit 1
fi

log() { printf '\033[1;34m[devcost]\033[0m %s\n' "$*"; }

log "Updating apt and installing base packages…"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates git build-essential python3 sqlite3 cron

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
mkdir -p "$APP_DIR" "$DATA_DIR" "$DATA_DIR/backups" "$ETC_DIR"
chown -R devcost:devcost "$APP_DIR" "$DATA_DIR"
chmod 750 "$DATA_DIR" "$DATA_DIR/backups"

if [[ -d "$APP_DIR/.git" ]]; then
	log "Updating existing checkout in $APP_DIR…"
	runuser -u devcost -- git -C "$APP_DIR" fetch --depth=1 origin "$REPO_BRANCH"
	runuser -u devcost -- git -C "$APP_DIR" checkout -B "$REPO_BRANCH" "origin/$REPO_BRANCH"
elif [[ -f "$(dirname "$0")/../package.json" ]]; then
	log "Copying local source into $APP_DIR…"
	rsync -a --delete --exclude node_modules --exclude build --exclude .git \
		"$(cd "$(dirname "$0")/.." && pwd)/" "$APP_DIR/"
	chown -R devcost:devcost "$APP_DIR"
else
	log "Cloning $REPO_URL ($REPO_BRANCH) into $APP_DIR…"
	runuser -u devcost -- git clone --depth=1 --branch "$REPO_BRANCH" "$REPO_URL" "$APP_DIR"
fi

log "Installing npm dependencies (this builds better-sqlite3 from source — ~1 min)…"
runuser -u devcost -- bash -c "cd $APP_DIR && npm ci --no-audit --no-fund"

log "Building app…"
runuser -u devcost -- bash -c "cd $APP_DIR && npm run build"

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
UPDATER_MODE=${UPDATER_MODE}
EOF
	chmod 640 "$ETC_DIR/devcost.env"
	chown root:devcost "$ETC_DIR/devcost.env"
else
	log "Existing $ETC_DIR/devcost.env detected — leaving most of it alone."
	# Ensure UPDATER_MODE is present and reflects the current install invocation,
	# so re-running with UPDATER_MODE=oneclick actually flips the live setting.
	if grep -q '^UPDATER_MODE=' "$ETC_DIR/devcost.env"; then
		sed -i "s/^UPDATER_MODE=.*/UPDATER_MODE=${UPDATER_MODE}/" "$ETC_DIR/devcost.env"
	else
		echo "UPDATER_MODE=${UPDATER_MODE}" >> "$ETC_DIR/devcost.env"
	fi
fi

log "Installing systemd unit…"
install -m 0644 "$APP_DIR/deploy/devcost.service" /etc/systemd/system/devcost.service
systemctl daemon-reload
systemctl enable devcost.service
systemctl restart devcost.service

log "Installing backup script and cron job…"
cat > /usr/local/sbin/devcost-backup <<EOF
#!/usr/bin/env bash
# Daily SQLite backup for devcost. Installed by deploy/install.sh.
set -euo pipefail
DB="${DATA_DIR}/devcost.sqlite"
DEST="${DATA_DIR}/backups"
KEEP_DAYS=${BACKUP_KEEP_DAYS}

if [[ ! -f "\$DB" ]]; then
	echo "devcost-backup: DB not found at \$DB" >&2
	exit 1
fi

mkdir -p "\$DEST"
out="\$DEST/devcost-\$(date +%F-%H%M).sqlite"
sqlite3 "\$DB" ".backup '\$out'"
gzip -f "\$out"

if (( KEEP_DAYS > 0 )); then
	find "\$DEST" -name 'devcost-*.sqlite.gz' -type f -mtime +\$KEEP_DAYS -delete
fi
EOF
chmod 0755 /usr/local/sbin/devcost-backup
chown root:root /usr/local/sbin/devcost-backup

if (( BACKUP_KEEP_DAYS > 0 )); then
	cat > /etc/cron.d/devcost-backup <<EOF
# devcost daily SQLite backup. Edit BACKUP_HOUR / BACKUP_KEEP_DAYS and rerun install.sh to change.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 ${BACKUP_HOUR} * * * devcost /usr/local/sbin/devcost-backup 2>&1 | /usr/bin/logger -t devcost-backup
EOF
	chmod 0644 /etc/cron.d/devcost-backup
	systemctl enable --now cron.service >/dev/null 2>&1 || true
	log "Backups: daily at ${BACKUP_HOUR}:00, retained for ${BACKUP_KEEP_DAYS} days, in ${DATA_DIR}/backups/"
else
	rm -f /etc/cron.d/devcost-backup
	log "Backups: disabled (BACKUP_KEEP_DAYS=0). Removed any existing cron job."
fi

# In-browser one-click updater (opt-in). Installs sudo + a sudoers rule giving
# the devcost user passwordless access to /usr/local/sbin/devcost-update only.
if [[ "$UPDATER_MODE" == "oneclick" ]]; then
	log "Installing one-click updater (UPDATER_MODE=oneclick)…"
	if ! command -v sudo >/dev/null 2>&1; then
		log "Installing sudo (required for one-click updater)…"
		apt-get install -y -qq sudo
	fi

	cat > /usr/local/sbin/devcost-update <<EOF
#!/usr/bin/env bash
# Self-update helper for devcost. Triggered from the web UI when UPDATER_MODE=oneclick.
# Runs as root (via sudoers rule). Backs up, pulls latest main, rebuilds, restarts.
set -euo pipefail
exec >>/var/log/devcost-update.log 2>&1
echo "[\$(date -Is)] devcost-update started"

APP_DIR=${APP_DIR}
REPO_BRANCH=${REPO_BRANCH}

# Pre-update backup (best effort — don't abort the upgrade if it fails)
/usr/local/sbin/devcost-backup || echo "warn: pre-update backup failed"

cd "\$APP_DIR"
runuser -u devcost -- git fetch --depth=1 origin "\$REPO_BRANCH"
runuser -u devcost -- git checkout -B "\$REPO_BRANCH" "origin/\$REPO_BRANCH"
runuser -u devcost -- npm ci --no-audit --no-fund
runuser -u devcost -- npm run build

systemctl restart devcost.service
echo "[\$(date -Is)] devcost-update finished"
EOF
	chmod 0755 /usr/local/sbin/devcost-update
	chown root:root /usr/local/sbin/devcost-update

	# sudoers drop-in. visudo -cf checks syntax before installing.
	tmp_sudoers="$(mktemp)"
	cat > "$tmp_sudoers" <<'EOF'
# Allow the devcost system user to invoke /usr/local/sbin/devcost-update only,
# with no password. Installed by deploy/install.sh when UPDATER_MODE=oneclick.
devcost ALL=(root) NOPASSWD: /usr/local/sbin/devcost-update
Defaults!/usr/local/sbin/devcost-update !requiretty
EOF
	if visudo -cf "$tmp_sudoers" >/dev/null; then
		install -m 0440 -o root -g root "$tmp_sudoers" /etc/sudoers.d/devcost
		rm -f "$tmp_sudoers"
		log "One-click updater installed. The web UI will show an 'Update now' button."
	else
		rm -f "$tmp_sudoers"
		echo "Generated sudoers file failed visudo syntax check — refusing to install." >&2
		exit 1
	fi
else
	# Tear down if the user previously enabled it and is now switching back to display
	if [[ -f /etc/sudoers.d/devcost ]]; then
		log "UPDATER_MODE=display — removing previous one-click updater files."
		rm -f /etc/sudoers.d/devcost /usr/local/sbin/devcost-update
	fi
fi

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
