import { sqlite } from './index';

/**
 * Embedded migration system.
 *
 * `init.ts` (initSchema) owns the v1 baseline — every table that existed when
 * this migration system was introduced. From this point forward, ALL schema
 * changes go in this file as new entries appended to the MIGRATIONS array.
 * Never edit a migration after it ships; add a new one instead.
 *
 * Each migration is wrapped in a transaction. Migrations should be idempotent
 * (use guards like columnExists / `IF NOT EXISTS`) so re-running on a
 * partially-migrated DB is safe.
 *
 * Names are immutable — they're the primary key in the `migrations` table.
 */

type Migration = { name: string; up: () => void };

function columnExists(table: string, col: string): boolean {
	const rows = sqlite
		.prepare(`PRAGMA table_info(${table})`)
		.all() as Array<{ name: string }>;
	return rows.some((r) => r.name === col);
}

const MIGRATIONS: Migration[] = [
	{
		name: '0001_add_url_to_projects_and_costs',
		up: () => {
			if (!columnExists('projects', 'url')) {
				sqlite.exec(`ALTER TABLE projects ADD COLUMN url TEXT`);
			}
			if (!columnExists('costs', 'url')) {
				sqlite.exec(`ALTER TABLE costs ADD COLUMN url TEXT`);
			}
		}
	},
	{
		name: '0002_add_cost_integrations',
		up: () => {
			if (!columnExists('costs', 'integration')) {
				sqlite.exec(`ALTER TABLE costs ADD COLUMN integration TEXT`);
			}
			sqlite.exec(`CREATE INDEX IF NOT EXISTS costs_integration_idx ON costs(integration)`);

			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS cost_credentials (
					cost_id INTEGER PRIMARY KEY REFERENCES costs(id) ON DELETE CASCADE,
					ciphertext TEXT NOT NULL,
					iv TEXT NOT NULL,
					auth_tag TEXT NOT NULL,
					hint TEXT,
					created_at INTEGER NOT NULL DEFAULT (unixepoch()),
					updated_at INTEGER NOT NULL DEFAULT (unixepoch())
				);
			`);

			sqlite.exec(`
				CREATE TABLE IF NOT EXISTS cost_usage_snapshots (
					cost_id INTEGER PRIMARY KEY REFERENCES costs(id) ON DELETE CASCADE,
					period_start INTEGER NOT NULL,
					period_end INTEGER NOT NULL,
					actual_amount REAL NOT NULL DEFAULT 0,
					projected_amount REAL NOT NULL DEFAULT 0,
					currency TEXT NOT NULL DEFAULT 'USD',
					breakdown TEXT,
					status TEXT NOT NULL DEFAULT 'ok',
					message TEXT,
					fetched_at INTEGER NOT NULL DEFAULT (unixepoch())
				);
			`);
		}
	}
];

export function runMigrations(): void {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS migrations (
			name TEXT PRIMARY KEY,
			applied_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
	`);

	const applied = new Set(
		(sqlite.prepare(`SELECT name FROM migrations`).all() as Array<{ name: string }>).map(
			(r) => r.name
		)
	);

	const insert = sqlite.prepare(`INSERT INTO migrations (name) VALUES (?)`);
	const tx = sqlite.transaction((m: Migration) => {
		m.up();
		insert.run(m.name);
	});

	for (const m of MIGRATIONS) {
		if (applied.has(m.name)) continue;
		tx(m);
		// eslint-disable-next-line no-console
		console.log(`[devcost] Applied migration: ${m.name}`);
	}
}
