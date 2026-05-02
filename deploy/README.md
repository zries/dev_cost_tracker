# Deploy

Two scripts:

- `proxmox-create.sh` — run on the **Proxmox host**. Creates a Debian 12 LXC, then runs `install.sh` inside it.
- `install.sh` — run **inside** the LXC (or any Debian 12 box). Idempotent, safe to re-run for upgrades.

Both honor a `PORT=` env var. Default is `6767`. Bind address is `HOST=0.0.0.0` so the app is reachable on the LAN.

## One-shot from Proxmox host

```bash
# Defaults: CTID 200, dhcp, 512 MiB RAM, 1 core, 4 GiB disk, port 6767
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
PORT=6767 bash deploy/install.sh
```

## Upgrading an existing install

Just re-run `install.sh` — it's idempotent. New code, new dependencies, new schema migrations all get picked up; your data and config are left alone.

**From the Proxmox host** (recommended, no SSH needed):

```bash
# Optional but recommended: take a backup first
pct exec 108 -- /usr/local/sbin/devcost-backup

# Pull latest main, rebuild, restart
pct exec 108 -- bash /opt/devcost/deploy/install.sh

# Watch the service come back up
pct exec 108 -- journalctl -u devcost -f
```

Replace `108` with your CTID.

**From inside the LXC**, as root (`pct enter 108` from the host gets you a shell):

```bash
/usr/local/sbin/devcost-backup     # optional pre-upgrade snapshot
bash /opt/devcost/deploy/install.sh
```

What gets touched:

| Path | Re-run behavior |
|---|---|
| `/opt/devcost` | `git fetch` + hard-checkout of `main`, then `npm ci` + `npm run build` |
| `/var/lib/devcost/devcost.sqlite` | not touched. Schema migrations run on next service boot via [src/lib/server/db/migrations.ts](../src/lib/server/db/migrations.ts). |
| `/etc/devcost/devcost.env` | not touched. New defaults (port, etc.) only apply to fresh installs. |
| `/etc/systemd/system/devcost.service` | replaced from repo, service restarted |
| `/etc/cron.d/devcost-backup` | replaced from latest defaults |

**Look for migrations in the log** the first time you upgrade after a schema change:

```
[devcost] Applied migration: 0001_add_url_to_projects_and_costs
```

If the upgrade goes sideways, restore from the backup you took (see [Backups](#backups) below).

**Heads-up on stale env defaults** — values in `/etc/devcost/devcost.env` are preserved across upgrades, so changes to the *default* `PORT` (e.g. `8080` → `6767`) don't propagate. If you want to adopt the new default on an existing install, edit the env file by hand:

```bash
pct exec 108 -- sed -i 's/^PORT=.*/PORT=6767/' /etc/devcost/devcost.env
pct exec 108 -- systemctl restart devcost
```

`ADMIN_USERNAME` / `ADMIN_PASSWORD` in that file are seed-only — they were used on first boot and ignored thereafter. Change passwords from `/account` in the UI.

## Changing the port later

```bash
sed -i 's/^PORT=.*/PORT=9000/' /etc/devcost/devcost.env
systemctl restart devcost
```

## Files installed

| Path | Owner | Purpose |
|---|---|---|
| `/opt/devcost` | `devcost:devcost` | App source + built bundle |
| `/var/lib/devcost/devcost.sqlite` | `devcost:devcost` | Database |
| `/var/lib/devcost/backups/` | `devcost:devcost` 0750 | Daily compressed backups |
| `/etc/devcost/devcost.env` | `root:devcost` 0640 | Runtime config — port, secret, admin creds |
| `/etc/systemd/system/devcost.service` | root | systemd unit |
| `/usr/local/sbin/devcost-backup` | root 0755 | Backup script (called by cron) |
| `/etc/cron.d/devcost-backup` | root 0644 | Cron job — daily at `BACKUP_HOUR:00` |

## Schema upgrades

The app runs an embedded migration system on every boot ([src/lib/server/db/migrations.ts](../src/lib/server/db/migrations.ts)). New schema changes ship as appended entries in the `MIGRATIONS` array and are applied idempotently — re-running `install.sh` to upgrade is safe. A `migrations` table records which ones have been applied to this DB.

## Backups

Automatic — `install.sh` installs a daily cron job at `BACKUP_HOUR` (default 03:00) that runs `/usr/local/sbin/devcost-backup`. It uses `sqlite3 .backup` (WAL-safe), gzips the output to `/var/lib/devcost/backups/devcost-YYYY-MM-DD-HHMM.sqlite.gz`, and prunes anything older than `BACKUP_KEEP_DAYS` (default 14). Set `BACKUP_KEEP_DAYS=0` on `install.sh` to disable.

Run a manual backup any time:
```bash
# from the Proxmox host
pct exec 108 -- /usr/local/sbin/devcost-backup

# or, from inside the LXC as root
runuser -u devcost -- /usr/local/sbin/devcost-backup
```

Restore from a backup:
```bash
systemctl stop devcost
gunzip -c /var/lib/devcost/backups/devcost-2026-05-02-0300.sqlite.gz > /var/lib/devcost/devcost.sqlite
chown devcost:devcost /var/lib/devcost/devcost.sqlite
systemctl start devcost
```

Cron output goes to syslog tagged `devcost-backup`:
```bash
journalctl -t devcost-backup --since '2 days ago'
```

## Logs / status

```bash
systemctl status devcost
journalctl -u devcost -f
```
