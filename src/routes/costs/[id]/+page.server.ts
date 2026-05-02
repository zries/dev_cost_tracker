import { error, fail, redirect, type Actions } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { costs, projects, costAllocations, tags } from '$lib/server/db/schema';
import { toMonthly, getCostTags, setCostTags } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	const id = Number(params.id);
	if (!Number.isFinite(id)) throw error(404, 'Cost not found');
	const cost = db.select().from(costs).where(eq(costs.id, id)).get();
	if (!cost) throw error(404, 'Cost not found');

	const allProjects = db.select().from(projects).all();
	const allocations = db
		.select()
		.from(costAllocations)
		.where(eq(costAllocations.costId, id))
		.all();
	const allTags = db.select().from(tags).all();
	const tagIds = getCostTags(id);

	return { cost, projects: allProjects, allocations, tags: allTags, tagIds };
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
	update: async ({ request, params }) => {
		const id = Number(params.id);
		const data = await request.formData();
		const name = String(data.get('name') ?? '').trim();
		const vendor = String(data.get('vendor') ?? '').trim() || null;
		const scope = String(data.get('scope') ?? '');
		const billingCycle = String(data.get('billing_cycle') ?? 'monthly');
		const amount = Number(data.get('amount'));
		const currency = String(data.get('currency') ?? 'USD').trim().toUpperCase() || 'USD';
		const notes = String(data.get('notes') ?? '').trim() || null;
		const active = data.get('active') === 'on';
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

		db.transaction((tx) => {
			tx.update(costs)
				.set({
					name,
					vendor,
					scope: scope as 'global',
					billingCycle: billingCycle as 'monthly',
					amount,
					monthlyAmount,
					currency,
					notes,
					active,
					updatedAt: Math.floor(Date.now() / 1000)
				})
				.where(eq(costs.id, id))
				.run();

			tx.delete(costAllocations).where(eq(costAllocations.costId, id)).run();

			if (scope === 'project' && Number.isFinite(projectId)) {
				tx.insert(costAllocations).values({ costId: id, projectId, weight: 1 }).run();
			} else if (scope === 'shared') {
				const allocs = parseAllocations(data);
				if (allocs.length > 0) {
					tx.insert(costAllocations)
						.values(allocs.map((a) => ({ ...a, costId: id })))
						.run();
				}
			}
		});

		setCostTags(id, scope === 'tag' ? tagIds : []);

		throw redirect(303, `/costs/${id}`);
	},
	delete: async ({ params }) => {
		const id = Number(params.id);
		db.delete(costs).where(eq(costs.id, id)).run();
		throw redirect(303, '/costs');
	}
};
