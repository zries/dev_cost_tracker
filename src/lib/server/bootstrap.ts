import { initSchema } from './db/init';
import { runMigrations } from './db/migrations';
import { seedAdmin } from './db/seed';
import { seedTags } from './db/seedTags';
import { purgeExpiredSessions } from './auth';

let started = false;

export async function bootstrap(): Promise<void> {
	if (started) return;
	started = true;
	initSchema();
	runMigrations();
	await seedAdmin();
	seedTags();
	purgeExpiredSessions();
}
