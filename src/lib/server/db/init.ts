import { sqlite } from './index';

/**
 * Idempotent schema bootstrap. Runs on every boot. Lets us ship a fresh LXC
 * without needing drizzle-kit migrations on disk — drizzle-kit is only needed
 * during development when changing the schema.
 */
export function initSchema(): void {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			username TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			must_change_password INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);

		CREATE TABLE IF NOT EXISTS projects (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			notes TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE UNIQUE INDEX IF NOT EXISTS projects_name_idx ON projects(name);

		CREATE TABLE IF NOT EXISTS costs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			vendor TEXT,
			scope TEXT NOT NULL,
			billing_cycle TEXT NOT NULL DEFAULT 'monthly',
			amount REAL NOT NULL,
			monthly_amount REAL NOT NULL,
			currency TEXT NOT NULL DEFAULT 'USD',
			notes TEXT,
			active INTEGER NOT NULL DEFAULT 1,
			started_on TEXT,
			ended_on TEXT,
			created_at INTEGER NOT NULL DEFAULT (unixepoch()),
			updated_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE INDEX IF NOT EXISTS costs_scope_idx ON costs(scope);
		CREATE INDEX IF NOT EXISTS costs_active_idx ON costs(active);

		CREATE TABLE IF NOT EXISTS cost_allocations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			cost_id INTEGER NOT NULL REFERENCES costs(id) ON DELETE CASCADE,
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			weight REAL NOT NULL DEFAULT 1
		);
		CREATE UNIQUE INDEX IF NOT EXISTS cost_allocations_cost_project_idx ON cost_allocations(cost_id, project_id);
		CREATE INDEX IF NOT EXISTS cost_allocations_cost_idx ON cost_allocations(cost_id);
		CREATE INDEX IF NOT EXISTS cost_allocations_project_idx ON cost_allocations(project_id);

		CREATE TABLE IF NOT EXISTS tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			created_at INTEGER NOT NULL DEFAULT (unixepoch())
		);
		CREATE UNIQUE INDEX IF NOT EXISTS tags_name_idx ON tags(name);
		CREATE INDEX IF NOT EXISTS tags_category_idx ON tags(category);

		CREATE TABLE IF NOT EXISTS project_tags (
			project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (project_id, tag_id)
		);
		CREATE INDEX IF NOT EXISTS project_tags_tag_idx ON project_tags(tag_id);

		CREATE TABLE IF NOT EXISTS cost_tags (
			cost_id INTEGER NOT NULL REFERENCES costs(id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
			PRIMARY KEY (cost_id, tag_id)
		);
		CREATE INDEX IF NOT EXISTS cost_tags_tag_idx ON cost_tags(tag_id);
	`);
}
