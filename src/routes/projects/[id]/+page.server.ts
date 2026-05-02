import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects, tags } from '$lib/server/db/schema';
import { computeProjectRollup, getProjectTags, setProjectTags } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

function parseTagIds(form: FormData): number[] {
	const out = new Set<number>();
	for (const v of form.getAll('tag_ids')) {
		const n = Number(v);
		if (Number.isFinite(n) && n > 0) out.add(n);
	}
	return [...out];
}

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(404, 'Project not found');
	const rollup = computeProjectRollup(id);
	if (!rollup) throw error(404, 'Project not found');
	const allTags = db.select().from(tags).all();
	const tagIds = getProjectTags(id);
	return { rollup, tags: allTags, tagIds };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const id = Number(params.id);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const url = String(data.get('url') ?? '').trim() || null;
		const status = String(data.get('status') ?? '');
		const notes = String(data.get('notes') ?? '').trim() || null;
		const tagIds = parseTagIds(data);

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!['active', 'paused', 'archived'].includes(status))
			return fail(400, { error: 'Invalid status.' });

		try {
			db.update(projects)
				.set({ name, url, status: status as 'active', notes, updatedAt: Math.floor(Date.now() / 1000) })
				.where(eq(projects.id, id))
				.run();
			setProjectTags(id, tagIds);
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
