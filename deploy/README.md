# Deploy

Two scripts:

- `proxmox-create.sh` — run on the **Proxmox host**. Creates a Debian 12 LXC, then runs `install.sh` inside it.
- `install.sh` — run **inside** the LXC (or any Debian 12 box). Idempotent, safe to re-run for upgrades.

Both honor a `PORT=` env var. Default is `8080`. Bind address is `HOST=0.0.0.0` so the app is reachable on the LAN.

## One-shot from Proxmox host

```bash
# Defaults: CTID 200, dhcp, 512 MiB RAM, 1 core, 4 GiB disk, port 8080
bash deploy/proxmox-create.sh

# Custom: pin a static IP and a different port
CTID=210 \
  IP=192.168.1.60/24,gw=192.168.1.1 \
  PORT=9000 \
  bash deploy/proxmox-create.sh
```

## Manual install in an existing LXC / VM

```bash
# Inside the container, as root
PORT=8080 bash deploy/install.sh
```

## Changing the port later

```bash
sed -i 's/^PORT=.*/PORT=9000/' /etc/devcost/devcost.env
systemctl restart devcost
```

## Files installed

| Path | Owner | Purpose |
|---|---|---|
| `/opt/devcost` | `devcost:devcost` | App source + built bundle |
| `/var/lib/devcost/devcost.sqlite` | `devcost:devcost` | Database (back this up!) |
| `/etc/devcost/devcost.env` | `root:devcost` 0640 | Runtime config — port, secret, admin creds |
| `/etc/systemd/system/devcost.service` | root | systemd unit |

## Backup

The whole app state is one SQLite file. Copy it (after a `.backup` to be safe):

```bash
sqlite3 /var/lib/devcost/devcost.sqlite ".backup /tmp/devcost-$(date +%F).sqlite"
```

## Logs / status

```bash
systemctl status devcost
journalctl -u devcost -f
```
