import { fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { costs, projects, costAllocations, tags, costTags } from '$lib/server/db/schema';
import { toMonthly, setCostTags } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	const all = db.select().from(costs).all();
	const allProjects = db.select().from(projects).all();
	const allocations = db.select().from(costAllocations).all();
	const allTags = db.select().from(tags).all();
	const ctRows = db.select().from(costTags).all();

	const allocByCost = new Map<number, { projectId: number; weight: number }[]>();
	for (const a of allocations) {
		if (!allocByCost.has(a.costId)) allocByCost.set(a.costId, []);
		allocByCost.get(a.costId)!.push({ projectId: a.projectId, weight: a.weight });
	}
	const tagsByCost = new Map<number, number[]>();
	for (const r of ctRows) {
		if (!tagsByCost.has(r.costId)) tagsByCost.set(r.costId, []);
		tagsByCost.get(r.costId)!.push(r.tagId);
	}

	return {
		costs: all
			.map((c) => ({
				...c,
				allocations: allocByCost.get(c.id) ?? [],
				tagIds: tagsByCost.get(c.id) ?? []
			}))
			.sort((a, b) => b.monthlyAmount - a.monthlyAmount),
		projects: allProjects,
		tags: allTags
	};
};

function parseAllocations(form: FormData): { projectId: number; weight: number }[] {
	const out: { projectId: number; weight: number }[] = [];
	for (const [key, value] of form.entries()) {
		const m = key.match(/^alloc_(\d+)$/);
		if (!m) continue;
		const projectId = Number(m[1]);
		const weight = Number(value);
		if (!Number.isFinite(weight) || weight <= 0) continue;
		out.push({ projectId, weight });
	}
	return out;
}

function parseTagIds(form: FormData): number[] {
	const out = new Set<number>();
	for (const v of form.getAll('tag_ids')) {
		const n = Number(v);
		if (Number.isFinite(n) && n > 0) out.add(n);
	}
	return [...out];
}

export const actions: Actions = {
	create: async ({ request }) => {
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const vendor = String(data.get('vendor') ?? '').trim() || null;
		const scope = String(data.get('scope') ?? '');
		const billingCycle = String(data.get('billing_cycle') ?? 'monthly');
		const amount = Number(data.get('amount'));
		const currency = String(data.get('currency') ?? 'USD').trim().toUpperCase() || 'USD';
		const notes = String(data.get('notes') ?? '').trim() || null;
		const projectId = Number(data.get('project_id'));
		const tagIds = parseTagIds(data);

		if (!name) return fail(400, { error: 'Name is required.' });
		if (!['global', 'shared', 'project', 'tag'].includes(scope))
			return fail(400, { error: 'Invalid scope.' });
		if (!['monthly', 'yearly', 'one_time'].includes(billingCycle))
			return fail(400, { error: 'Invalid billing cycle.' });
		if (!Number.isFinite(amount) || amount < 0)
			return fail(400, { error: 'Amount must be a non-negative number.' });
		if (scope === 'tag' && tagIds.length === 0)
			return fail(400, { error: 'Pick at least one tag for tag-scoped costs.' });

		const monthlyAmount = toMonthly(amount, billingCycle as 'monthly');

		let newId: number;
		try {
			newId = db.transaction((tx) => {
				const inserted = tx
					.insert(costs)
					.values({
						name,
						vendor,
						scope: scope as 'global',
						billingCycle: billingCycle as 'monthly',
						amount,
						monthlyAmount,
						currency,
						notes
					})
					.returning({ id: costs.id })
					.get();

				if (scope === 'project') {
					if (!Number.isFinite(projectId)) {
						throw new Error('Project is required for project-scoped costs.');
					}
					tx.insert(costAllocations).values({ costId: inserted.id, projectId, weight: 1 }).run();
				} else if (scope === 'shared') {
					const allocs = parseAllocations(data);
					if (allocs.length > 0) {
						tx.insert(costAllocations)
							.values(allocs.map((a) => ({ ...a, costId: inserted.id })))
							.run();
					}
				}
				return inserted.id;
			});
		} catch (err) {
			const msg = err instanceof Error ? err.message : 'Could not create cost.';
			return fail(400, { error: msg });
		}

		if (scope === 'tag') setCostTags(newId, tagIds);
		throw redirect(303, `/costs/${newId}`);
	},
	delete: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		if (!Number.isFinite(id)) return fail(400, { error: 'Invalid id.' });
		db.delete(costs).where(eq(costs.id, id)).run();
		throw redirect(303, '/costs');
	},
	toggleActive: async ({ request }) => {
		const data = await request.formData();
		const id = Number(data.get('id'));
		const active = data.get('active') === '1';
		db.update(costs)
			.set({ active, updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(costs.id, id))
			.run();
		throw redirect(303, '/costs');
	}
};
