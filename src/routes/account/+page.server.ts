import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { hashPassword, verifyPassword } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) throw redirect(303, '/login');
	return {
		user: locals.user,
		first: url.searchParams.get('first') === '1'
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) throw redirect(303, '/login');
		const data = await request.formData();
		const current = String(data.get('current') ?? '');
		const next = String(data.get('next') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (next.length < 8) return fail(400, { error: 'New password must be at least 8 characters.' });
		if (next !== confirm) return fail(400, { error: 'Passwords do not match.' });

		const user = db.select().from(users).where(eq(users.id, locals.user.id)).get();
		if (!user) throw redirect(303, '/login');

		const ok = await verifyPassword(user.passwordHash, current);
		if (!ok) return fail(400, { error: 'Current password is incorrect.' });

		const hash = await hashPassword(next);
		db.update(users)
			.set({ passwordHash: hash, mustChangePassword: false, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(users.id, user.id))
			.run();

		return { success: true };
	}
};
