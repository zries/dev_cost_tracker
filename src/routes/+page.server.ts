import { computeDashboard, findCostIssues } from '$lib/server/rollup';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	return { summary: computeDashboard(), issues: findCostIssues() };
};
