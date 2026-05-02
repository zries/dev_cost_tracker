import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects } from '$lib/server/db/schema';
import { computeProjectRollup } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(404, 'Project not found');
	const rollup = computeProjectRollup(id);
	if (!rollup) throw error(404, 'Project not found');
	return { rollup };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const status = String(data.get('status') ?? '');
		const notes = String(data.get('notes') ?? '').trim() || null;

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!['active', 'paused', 'archived'].includes(status))
			return fail(400, { error: 'Invalid status.' });

		try {
			db.update(projects)
				.set({ name, status: status as 'active', notes, updatedAt: Math.floor(Date.now() / 1000) })
				.where(eq(projects.id, id))
				.run();
		} catch (err) {
			const msg = err instanceof Error && err.message.includes('UNIQUE')
				? 'A project with that name already exists.'
				: 'Could not update project.';
			return fail(400, { error: msg });
		}
		throw redirect(303, `/projects/${id}`);
	},
	delete: async ({ params }) => {
		const id = Number(params.id);
		db.delete(projects).where(eq(projects.id, id)).run();
		throw redirect(303, '/projects');
	}
};
