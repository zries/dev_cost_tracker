# devcost — guide for Claude

Self-hosted dev-cost tracker. SvelteKit 2 + Svelte 5 (runes) + better-sqlite3 + Drizzle, deployed as a systemd service in a Debian 12 LXC.

## Run / build

```bash
npm install        # builds better-sqlite3 native bindings
npm run dev        # vite dev server on :5173
npm run build      # produces ./build (adapter-node)
npm run start      # runs the built bundle (uses PORT, HOST envs)
npm run check      # svelte-check + tsc
npm run db:generate  # drizzle-kit, when schema.ts changes
```

The DB schema is auto-created on boot via `src/lib/server/db/init.ts` (idempotent `CREATE TABLE IF NOT EXISTS`). Drizzle is the query builder; drizzle-kit is dev-only and not required at runtime.

## Architecture

- **All server work lives in `src/lib/server/`.** Anything that touches the DB or auth must be importable only from `+page.server.ts` / `+server.ts` / `hooks.server.ts`.
- **Cost rollup is in [src/lib/server/rollup.ts](src/lib/server/rollup.ts).** This is the single source of truth for how a cost gets attributed to a project. If you're adding a new cost type or scope, change it here.
- **Bootstrap** runs once at process start via top-level `await` in [src/hooks.server.ts](src/hooks.server.ts) → [bootstrap.ts](src/lib/server/bootstrap.ts) → schema init + admin seed + expired-session purge.
- **Auth**: argon2id hashes, opaque random session tokens stored in the `sessions` table, cookie name `devcost_session`, 30-day TTL. `hooks.server.ts` redirects unauthenticated requests to `/login?next=…`.

## Data model

Three primary tables (see [schema.ts](src/lib/server/db/schema.ts)):

- `projects` — name, status (`active|paused|archived`), notes
- `costs` — name, vendor, **scope** (`global|shared|project`), billing_cycle (`monthly|yearly|one_time`), amount + monthly_amount (denormalized), currency, active flag
- `cost_allocations` — `(cost_id, project_id, weight)`. Empty for `global` costs; one row for `project`; N rows for `shared`.

**Scope semantics** — keep these consistent everywhere:
- `global`: no allocation rows. Spread equally across `status='active'` projects in `computeDashboard`.
- `shared`: N allocation rows. Weights are arbitrary positives; normalized to fractions at display time.
- `project`: exactly one allocation row, weight = 1.

The `monthly_amount` column is computed by `toMonthly()` and stored on insert/update. Yearly → `/ 12`. `one_time` → `0` (tracked but doesn't contribute to monthly burn).

## Conventions

- **Form actions over API endpoints.** Use SvelteKit `actions` in `+page.server.ts` for all mutations. Use `+server.ts` only when there's no page (e.g. `/logout`).
- **Always `throw redirect(303, …)` after a successful mutation** so reload doesn't resubmit.
- **Money is `real` in SQLite, formatted in `$lib/format.ts`.** Don't introduce a separate cents-as-int column unless we discover precision issues.
- **Svelte 5 runes only** (`$state`, `$derived`, `$props`). No `export let` / reactive `$:` in new code.
- **No client-side data fetching.** Everything goes through `load` functions or form actions.
- **Tailwind component classes are in [src/app.css](src/app.css)** (`.btn`, `.card`, `.input`, `.badge-{scope}`, etc). Reuse those before writing one-off utility soup.

## Deploy

`deploy/install.sh` is the canonical install/upgrade path. It assumes Debian 12, creates a `devcost` system user, clones into `/opt/devcost`, builds, writes `/etc/devcost/devcost.env` (only on first run — never overwrites), installs the systemd unit, and starts the service. Re-run it to upgrade. `deploy/proxmox-create.sh` wraps `pct create` + this script.

The systemd unit is hardened (`ProtectSystem=strict`, `ReadWritePaths=/var/lib/devcost`). If you add new on-disk state, expand `ReadWritePaths` accordingly.

## Things to check before claiming done

- `npm run check` is clean
- `npm run build` succeeds (adapter-node output in `./build`)
- For UI changes: the dev server actually renders the page and the form submits without a console error. Type checks alone don't catch broken `action="?/foo"` typos or missing `+page.server.ts` imports.
