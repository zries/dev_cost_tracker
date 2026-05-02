# devcost

Self-hosted tracker for the running cost of your dev projects. Designed to live in a small Proxmox LXC and answer one question quickly: **"how much is each project actually costing me per month?"**

Built for the case where:
- Some costs are **global** to your workflow (e.g. a Claude Max sub) and should be spread across every active project.
- Some are **shared** across a few projects in a non-equal split (e.g. Supabase used 70% by Project A, 30% by Project B).
- Some are **project-specific** (e.g. an Appwrite plan attached to one project).

## Stack

- **SvelteKit 2** + **Svelte 5** + **TypeScript**
- **SQLite** via **better-sqlite3** + **Drizzle ORM** (one file on disk, WAL mode)
- **Tailwind** for styling
- **Argon2id** password hashing, cookie sessions
- Runs as a single Node process under **systemd** in a Debian 12 LXC

## Quick start (local dev)

```bash
npm install
cp .env.example .env       # tweak PORT etc. if you want
npm run dev                # http://localhost:5173
```

First boot seeds an `admin / admin` user and prompts you to change the password.

## Deploy to a Proxmox LXC

See [`deploy/README.md`](deploy/README.md). Short version, on the Proxmox host:

```bash
bash deploy/proxmox-create.sh        # 512 MiB / 1 core / 4 GiB / port 6767
```

Then open `http://<container-ip>:6767`. Log in as `admin / admin`.

## Upgrade an existing install

Re-run the same script inside the LXC — it's idempotent. New code, dependencies, and schema migrations get picked up; your data and config are left alone.

```bash
# from the Proxmox host
pct exec 108 -- /usr/local/sbin/devcost-backup       # optional pre-upgrade snapshot
pct exec 108 -- bash /opt/devcost/deploy/install.sh
```

Full details (what's touched, what isn't, watching migrations apply, restoring from backup) in [`deploy/README.md`](deploy/README.md#upgrading-an-existing-install).

## How costs roll up

Every cost has a **scope**:

| Scope | Stored as | Per-project share |
|---|---|---|
| `global` | bare cost row | `monthly / count(active projects)` |
| `shared` | cost row + N allocations with **weights** | `weight / sum(weights) × monthly` |
| `project` | cost row + 1 allocation, weight 1 | full monthly amount |

Weights are arbitrary numbers, normalized to 100% at display time. So `1, 1, 2` = 25/25/50%. If you just want even split, use the **"spread evenly across active"** button.

The dashboard shows totals per project and a grand total. Yearly costs are normalized to monthly (`/ 12`); one-time costs are tracked but excluded from the monthly burn.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `6767` | HTTP port |
| `HOST` | `0.0.0.0` | Bind address (set to `127.0.0.1` if fronted by a reverse proxy) |
| `DATABASE_PATH` | `./data/devcost.sqlite` (dev) / `/var/lib/devcost/devcost.sqlite` (LXC) | SQLite file path |
| `SESSION_SECRET` | none | 32+ byte secret. `openssl rand -hex 32` |
| `ADMIN_USERNAME` | `admin` | Initial admin (only used on first boot) |
| `ADMIN_PASSWORD` | `admin` | Initial admin password (only used on first boot) |
| `COOKIE_SECURE` | `true` in prod | Set to `false` to allow non-HTTPS cookies on LAN |

## Backup

It's one SQLite file. Copy `/var/lib/devcost/devcost.sqlite` (use `sqlite3 ... ".backup ..."` for a hot backup).

## Project layout

```
src/
  app.html, app.css, app.d.ts
  hooks.server.ts                 auth + bootstrap
  lib/
    format.ts                     money/percent formatters
    components/
      AllocationEditor.svelte
    server/
      auth.ts                     argon2 + sessions
      bootstrap.ts                init schema + seed admin on boot
      rollup.ts                   per-project cost computation
      db/
        index.ts                  drizzle + better-sqlite3
        schema.ts
        init.ts                   idempotent CREATE TABLE on boot
        seed.ts
  routes/
    +layout.svelte, +layout.server.ts
    +page.svelte, +page.server.ts          dashboard
    login/, logout/, account/
    projects/                              list + [id] detail
    costs/                                 list + [id] detail
deploy/
  install.sh                      Debian 12 install/upgrade
  proxmox-create.sh               Proxmox host: pct create + install
  devcost.service                 systemd unit
  devcost.env.example             /etc/devcost/devcost.env template
```
