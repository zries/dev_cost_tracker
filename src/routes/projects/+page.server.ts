import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { projects, tags, projectTags } from '$lib/server/db/schema';
import { computeDashboard, setProjectTags } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

function parseTagIds(form: FormData): number[] {
	const out = new Set<number>();
	for (const v of form.getAll('tag_ids')) {
		const n = Number(v);
		if (Number.isFinite(n) && n > 0) out.add(n);
	}
	return [...out];
}

export const load: PageServerLoad = async () => {
	const summary = computeDashboard();
	const allTags = db.select().from(tags).all();
	const ptRows = db.select().from(projectTags).all();
	const tagsByProject = new Map<number, number[]>();
	for (const r of ptRows) {
		if (!tagsByProject.has(r.projectId)) tagsByProject.set(r.projectId, []);
		tagsByProject.get(r.projectId)!.push(r.tagId);
	}
	return {
		projects: summary.perProject.map((r) => ({
			...r.project,
			totalMonthly: r.totalMonthly,
			directMonthly: r.directMonthly,
			sharedMonthly: r.sharedMonthly,
			globalMonthly: r.globalMonthly,
			tagMonthly: r.tagMonthly,
			lineCount: r.lines.length,
			tagIds: tagsByProject.get(r.project.id) ?? []
		})),
		tags: allTags
	};
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const url = String(data.get('url') ?? '').trim() || null;
		const status = String(data.get('status') ?? 'active');
		const notes = String(data.get('notes') ?? '').trim() || null;
		const tagIds = parseTagIds(data);

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!['active', 'paused', 'archived'].includes(status))
			return fail(400, { error: 'Invalid status.' });

		try {
			const inserted = db
				.insert(projects)
				.values({ name, url, status: status as 'active', notes })
				.returning({ id: projects.id })
				.get();
			if (tagIds.length > 0) setProjectTags(inserted.id, tagIds);
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
