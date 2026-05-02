import { initSchema } from './db/init';
import { seedAdmin } from './db/seed';
import { seedTags } from './db/seedTags';
import { purgeExpiredSessions } from './auth';

let started = false;

export async function bootstrap(): Promise<void> {
	if (started) return;
	started = true;
	initSchema();
	await seedAdmin();
	seedTags();
	purgeExpiredSessions();
}
