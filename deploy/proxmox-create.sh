#!/usr/bin/env bash
# Creates a Debian 12 LXC on a Proxmox host and installs devcost into it.
# Run this on the Proxmox host (not inside a container).
#
# Interactive by default — prompts you for each setting with a sensible default.
# Skip prompts entirely with --non-interactive (or -y) and the defaults / env
# overrides will be used as-is. Any value passed via env var pre-fills the
# prompt.
#
# Tunable env vars (all optional):
#   CTID=200                    Container ID
#   HOSTNAME=devcost
#   STORAGE=local-lvm           Proxmox storage pool for the rootfs
#   DISK_GB=4
#   MEMORY_MB=512
#   CORES=1
#   BRIDGE=vmbr0
#   IP=dhcp                     or e.g. 192.168.1.50/24,gw=192.168.1.1
#   TEMPLATE=local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst
#   PASSWORD=                   root password for the container; auto-generated if empty
#   PORT=8080                   App port (passed through to install.sh)
#   ADMIN_USERNAME=admin
#   ADMIN_PASSWORD=admin
#   REPO_URL=https://github.com/zries/dev_cost_tracker.git
#   REPO_BRANCH=main
#   UNPRIVILEGED=1              0 for privileged container
#   ONBOOT=1
#
# Examples:
#   bash deploy/proxmox-create.sh                    # interactive
#   CTID=210 PORT=9000 bash deploy/proxmox-create.sh # interactive, with defaults pre-filled
#   bash deploy/proxmox-create.sh -y                 # non-interactive, accept all defaults

set -euo pipefail

INTERACTIVE=1
ASSUME_YES=0
for arg in "$@"; do
	case "$arg" in
		-y|--yes|--non-interactive|--unattended) INTERACTIVE=0; ASSUME_YES=1 ;;
		-h|--help)
			sed -n '2,/^set -euo/p' "$0" | sed 's/^# \{0,1\}//' | head -n -1
			exit 0
			;;
		*) echo "Unknown arg: $arg" >&2; exit 2 ;;
	esac
done

# Auto-disable prompts if stdin isn't a TTY (e.g. piped via curl)
if [[ ! -t 0 ]]; then
	INTERACTIVE=0
fi

CTID="${CTID:-200}"
HOSTNAME="${HOSTNAME:-devcost}"
STORAGE="${STORAGE:-local-lvm}"
DISK_GB="${DISK_GB:-4}"
MEMORY_MB="${MEMORY_MB:-512}"
CORES="${CORES:-1}"
BRIDGE="${BRIDGE:-vmbr0}"
IP="${IP:-dhcp}"
TEMPLATE="${TEMPLATE:-local:vztmpl/debian-12-standard_12.2-1_amd64.tar.zst}"
PASSWORD="${PASSWORD:-}"
PORT="${PORT:-8080}"
ADMIN_USERNAME="${ADMIN_USERNAME:-admin}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin}"
REPO_URL="${REPO_URL:-https://github.com/zries/dev_cost_tracker.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
UNPRIVILEGED="${UNPRIVILEGED:-1}"
ONBOOT="${ONBOOT:-1}"

ask() {
	local var="$1" prompt="$2" current="${!1}" input
	if (( ! INTERACTIVE )); then return 0; fi
	read -rp "$prompt [$current]: " input </dev/tty
	if [[ -n "$input" ]]; then
		printf -v "$var" '%s' "$input"
	fi
}

ask_secret() {
	local var="$1" prompt="$2" current="${!1}" input mask
	if (( ! INTERACTIVE )); then return 0; fi
	if [[ -n "$current" ]]; then mask="(set, press Enter to keep)"; else mask="(empty, press Enter to auto-generate)"; fi
	read -rsp "$prompt $mask: " input </dev/tty; echo
	if [[ -n "$input" ]]; then
		printf -v "$var" '%s' "$input"
	fi
}

ask_yn() {
	local var="$1" prompt="$2" current="${!1}" input default_letter
	if (( ! INTERACTIVE )); then return 0; fi
	if [[ "$current" == "1" ]]; then default_letter="Y/n"; else default_letter="y/N"; fi
	read -rp "$prompt [$default_letter]: " input </dev/tty
	if [[ -z "$input" ]]; then return 0; fi
	case "$input" in
		[Yy]|[Yy][Ee][Ss]) printf -v "$var" '%s' "1" ;;
		[Nn]|[Nn][Oo])      printf -v "$var" '%s' "0" ;;
	esac
}

if (( INTERACTIVE )); then
	echo "==========================================="
	echo " devcost LXC — interactive setup"
	echo " (press Enter to accept the default in [brackets])"
	echo " (run with -y to skip these prompts)"
	echo "==========================================="
	echo

	echo "── Container ──"
	ask CTID         "Container ID (CTID)"
	ask HOSTNAME     "Hostname"
	ask CORES        "vCPU cores"
	ask MEMORY_MB    "Memory (MB)"
	ask DISK_GB      "Root disk (GB)"
	ask STORAGE      "Proxmox storage pool"
	ask TEMPLATE     "LXC template"
	ask_yn UNPRIVILEGED "Unprivileged container?"
	ask_yn ONBOOT       "Start on boot?"

	echo
	echo "── Network ──"
	ask BRIDGE   "Network bridge"
	ask IP       "IP (dhcp or CIDR,gw=...)"

	echo
	echo "── App ──"
	ask PORT            "App port"
	ask ADMIN_USERNAME  "Initial admin username"
	ask_secret ADMIN_PASSWORD "Initial admin password"

	echo
	echo "── Repo ──"
	ask REPO_URL    "Git repo URL"
	ask REPO_BRANCH "Git branch"

	echo
	echo "── Container root password ──"
	ask_secret PASSWORD "Container root password"
fi

# Validate
if ! [[ "$CTID" =~ ^[0-9]+$ ]] || (( CTID < 100 )); then
	echo "Invalid CTID '$CTID' — must be a number ≥ 100." >&2; exit 2
fi
for n in CORES MEMORY_MB DISK_GB PORT; do
	if ! [[ "${!n}" =~ ^[0-9]+$ ]] || (( ${!n} < 1 )); then
		echo "Invalid $n='${!n}' — must be a positive integer." >&2; exit 2
	fi
done
if [[ "$IP" != "dhcp" && ! "$IP" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+ ]]; then
	echo "Invalid IP '$IP' — use 'dhcp' or '<addr>/<prefix>,gw=<gateway>'." >&2; exit 2
fi
if [[ -z "$PASSWORD" ]]; then
	PASSWORD="$(openssl rand -base64 18)"
	echo "Auto-generated container root password: $PASSWORD"
fi

# Confirmation summary
cat <<SUMMARY

==========================================
 Review settings
==========================================
 CTID:           $CTID
 Hostname:       $HOSTNAME
 Cores / RAM:    $CORES vCPU / ${MEMORY_MB} MB
 Disk:           ${DISK_GB} GB on $STORAGE
 Template:       $TEMPLATE
 Unprivileged:   $UNPRIVILEGED          Onboot: $ONBOOT
 Network:        $BRIDGE   ip=$IP
 App port:       $PORT
 Admin login:    $ADMIN_USERNAME
 Repo:           $REPO_URL ($REPO_BRANCH)
==========================================
SUMMARY

if (( INTERACTIVE )) && (( ! ASSUME_YES )); then
	read -rp "Proceed? [Y/n]: " confirm </dev/tty
	if [[ "$confirm" =~ ^[Nn] ]]; then
		echo "Aborted."
		exit 0
	fi
fi

if ! command -v pct >/dev/null 2>&1; then
	echo "pct not found — run this on the Proxmox host." >&2
	exit 1
fi

if pct status "$CTID" >/dev/null 2>&1; then
	echo "Container $CTID already exists. Stop & destroy it, or pick a different CTID." >&2
	exit 1
fi

NET="name=eth0,bridge=${BRIDGE},ip=${IP}"

echo "Creating LXC $CTID ($HOSTNAME)…"
pct create "$CTID" "$TEMPLATE" \
	--hostname "$HOSTNAME" \
	--cores "$CORES" \
	--memory "$MEMORY_MB" \
	--swap 256 \
	--rootfs "${STORAGE}:${DISK_GB}" \
	--net0 "$NET" \
	--features "nesting=1" \
	--unprivileged "$UNPRIVILEGED" \
	--onboot "$ONBOOT" \
	--password "$PASSWORD" \
	--ostype debian

echo "Starting LXC…"
pct start "$CTID"

# Wait for network
for _ in {1..30}; do
	if pct exec "$CTID" -- bash -c 'getent hosts deb.debian.org >/dev/null 2>&1'; then break; fi
	sleep 1
done

echo "Running install.sh inside container…"
pct exec "$CTID" -- bash -c "
	set -e
	apt-get update -qq
	apt-get install -y -qq curl
	export PORT='${PORT}'
	export ADMIN_USERNAME='${ADMIN_USERNAME}'
	export ADMIN_PASSWORD='${ADMIN_PASSWORD}'
	export REPO_URL='${REPO_URL}'
	export REPO_BRANCH='${REPO_BRANCH}'
	curl -fsSL '${REPO_URL%.git}/raw/${REPO_BRANCH}/deploy/install.sh' | bash
"

CT_IP="$(pct exec "$CTID" -- bash -c "hostname -I | awk '{print \$1}'" 2>/dev/null || true)"

echo
echo "=========================================="
echo " devcost LXC ready"
echo "=========================================="
echo " CTID:        $CTID"
echo " Hostname:    $HOSTNAME"
echo " Container IP: ${CT_IP:-<unknown — check pct exec $CTID -- ip a>}"
echo " URL:         http://${CT_IP:-<container-ip>}:${PORT}"
echo " Login:       ${ADMIN_USERNAME} / ${ADMIN_PASSWORD}  (change after first login)"
echo " Root pw:     $PASSWORD"
echo "=========================================="
