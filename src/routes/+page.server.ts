import { computeDashboard, findCostIssues } from '$lib/server/rollup';
import { listDashboardIntegrations, refreshUsage } from '$lib/server/integrations';
import { fail, redirect, type Actions } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return {
		summary: computeDashboard(),
		issues: findCostIssues(),
		integrations: listDashboardIntegrations()
	};
};

export const actions: Actions = {
	refreshAll: async () => {
		const cards = listDashboardIntegrations();
		const errors: string[] = [];
		for (const card of cards) {
			if (!card.hasCredentials) continue;
			const r = await refreshUsage(card.costId);
			if (!r.ok) errors.push(`${card.costName}: ${r.error}`);
		}
		if (errors.length > 0) return fail(400, { error: errors.join(' · ') });
		throw redirect(303, '/');
	}
};
