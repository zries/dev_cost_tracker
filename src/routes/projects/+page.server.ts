import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { computeDashboard } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const summary = computeDashboard();
	return {
		projects: summary.perProject.map((r) => ({
			...r.project,
			totalMonthly: r.totalMonthly,
			directMonthly: r.directMonthly,
			sharedMonthly: r.sharedMonthly,
			globalMonthly: r.globalMonthly,
			lineCount: r.lines.length
		}))
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const status = String(data.get('status') ?? 'active');
		const notes = String(data.get('notes') ?? '').trim() || null;

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!['active', 'paused', 'archived'].includes(status))
			return fail(400, { error: 'Invalid status.' });

		try {
			db.insert(projects).values({ name, status: status as 'active', notes }).run();
		} catch (err) {
			const msg = err instanceof Error && err.message.includes('UNIQUE')
				? 'A project with that name already exists.'
				: 'Could not create project.';
			return fail(400, { error: msg });
		}
		throw redirect(303, '/projects');
	},
	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		db.delete(projects).where(eq(projects.id, id)).run();
		throw redirect(303, '/projects');
	}
};
