import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import {
	createSession,
	setSessionCookie,
	verifyPassword
} from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (locals.user) {
		const next = url.searchParams.get('next') ?? '/';
		throw redirect(303, next);
	}
	return {};
};

export const actions: Actions = {
	default: async ({ request, cookies, url }) => {
		const data = await request.formData();
		const username = String(data.get('username') ?? '').trim();
		const password = String(data.get('password') ?? '');

		if (!username || !password) {
			return fail(400, { username, error: 'Username and password are required.' });
		}

		const user = db.select().from(users).where(eq(users.username, username)).get();
		if (!user) {
			return fail(400, { username, error: 'Invalid credentials.' });
		}
		const ok = await verifyPassword(user.passwordHash, password);
		if (!ok) {
			return fail(400, { username, error: 'Invalid credentials.' });
		}

		const session = await createSession(user.id);
		setSessionCookie(cookies, session.id, session.expiresAt);

		const next = url.searchParams.get('next') ?? '/';
		throw redirect(303, user.mustChangePassword ? '/account?first=1' : next);
	}
};
