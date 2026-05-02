#!/usr/bin/env bash
# Creates a Debian 12 LXC on a Proxmox host and installs devcost into it.
# Run this on the Proxmox host (not inside a container).
#
# Tunable env vars (with defaults):
#   CTID=200                    Container ID
#   HOSTNAME=devcost
#   STORAGE=local-lvm           Storage for the rootfs
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
#   REPO_URL=https://github.com/zries-prj/devcost.git
#   REPO_BRANCH=main
#   UNPRIVILEGED=1              0 for privileged container
#   ONBOOT=1
#
# Example:
#   CTID=210 IP=192.168.1.60/24,gw=192.168.1.1 PORT=9000 bash deploy/proxmox-create.sh

set -euo pipefail

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
REPO_URL="${REPO_URL:-https://github.com/zries-prj/devcost.git}"
REPO_BRANCH="${REPO_BRANCH:-main}"
UNPRIVILEGED="${UNPRIVILEGED:-1}"
ONBOOT="${ONBOOT:-1}"

if ! command -v pct >/dev/null 2>&1; then
	echo "pct not found — run this on the Proxmox host." >&2
	exit 1
fi

if pct status "$CTID" >/dev/null 2>&1; then
	echo "Container $CTID already exists. Stop & destroy it, or pick a different CTID." >&2
	exit 1
fi

if [[ -z "$PASSWORD" ]]; then
	PASSWORD="$(openssl rand -base64 18)"
	echo "Generated container root password: $PASSWORD"
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
