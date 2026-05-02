import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq, sql } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { tags, projectTags, costTags } from '$lib/server/db/schema';
import { TAG_CATEGORIES } from '$lib/server/db/seedTags';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const all = db.select().from(tags).all();

	const projectCounts = db
		.select({ tagId: projectTags.tagId, n: sql<number>`count(*)`.as('n') })
		.from(projectTags)
		.groupBy(projectTags.tagId)
		.all();
	const costCounts = db
		.select({ tagId: costTags.tagId, n: sql<number>`count(*)`.as('n') })
		.from(costTags)
		.groupBy(costTags.tagId)
		.all();

	const pCount = new Map(projectCounts.map((r) => [r.tagId, Number(r.n)]));
	const cCount = new Map(costCounts.map((r) => [r.tagId, Number(r.n)]));

	const enriched = all
		.map((t) => ({
			...t,
			projectCount: pCount.get(t.id) ?? 0,
			costCount: cCount.get(t.id) ?? 0
		}))
		.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

	const knownCategories = [...new Set([...TAG_CATEGORIES, ...all.map((t) => t.category)])].sort();

	return { tags: enriched, categories: knownCategories };
};

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const category = String(data.get('category') ?? '').trim();

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!category) return fail(400, { error: 'Category is required.' });
		if (name.length > 60) return fail(400, { error: 'Name is too long (max 60).' });
		if (category.length > 40) return fail(400, { error: 'Category is too long (max 40).' });

		try {
			db.insert(tags).values({ name, category }).run();
		} catch (err) {
			const msg = err instanceof Error && err.message.includes('UNIQUE')
				? `Tag "${name}" already exists.`
				: 'Could not create tag.';
			return fail(400, { error: msg });
		}
		throw redirect(303, '/tags');
	},
	rename: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		const name = String(data.get('name') ?? '').trim();
		const category = String(data.get('category') ?? '').trim();
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		if (!name || !category) return fail(400, { error: 'Name and category are required.' });

		try {
			db.update(tags).set({ name, category }).where(eq(tags.id, id)).run();
		} catch (err) {
			const msg = err instanceof Error && err.message.includes('UNIQUE')
				? `Tag "${name}" already exists.`
				: 'Could not rename tag.';
			return fail(400, { error: msg });
		}
		throw redirect(303, '/tags');
	},
	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		db.delete(tags).where(eq(tags.id, id)).run();
		throw redirect(303, '/tags');
	}
};
