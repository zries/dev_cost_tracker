import { db } from './index';
import { users } from './schema';
import { hashPassword } from '../auth';

export async function seedAdmin(): Promise<void> {
	const existing = db.select({ id: users.id }).from(users).limit(1).all();
	if (existing.length > 0) return;

	const username = process.env.ADMIN_USERNAME ?? 'admin';
	const password = process.env.ADMIN_PASSWORD ?? 'admin';
	const passwordHash = await hashPassword(password);

	db.insert(users).values({ username, passwordHash, mustChangePassword: true }).run();
	// eslint-disable-next-line no-console
	console.log(`[devcost] Seeded initial user "${username}". Change the password after first login.`);
}
