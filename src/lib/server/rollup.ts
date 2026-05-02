import { eq } from 'drizzle-orm';
import { db } from './db';
import { costs, projects, costAllocations, type Cost, type Project } from './db/schema';

export type ProjectRollup = {
	project: Project;
	directMonthly: number;
	sharedMonthly: number;
	globalMonthly: number;
	totalMonthly: number;
	lines: RollupLine[];
};

export type RollupLine = {
	costId: number;
	name: string;
	vendor: string | null;
	scope: Cost['scope'];
	share: number; // 0..1 fraction of cost attributed to this project
	amount: number; // monthly attributed amount
};

export type DashboardSummary = {
	totalMonthly: number;
	globalMonthly: number;
	sharedMonthly: number;
	projectMonthly: number;
	activeProjects: number;
	activeCosts: number;
	perProject: ProjectRollup[];
};

/** Convert any billing cycle to a monthly equivalent. */
export function toMonthly(amount: number, cycle: Cost['billingCycle']): number {
	switch (cycle) {
		case 'monthly':
			return amount;
		case 'yearly':
			return amount / 12;
		case 'one_time':
			return 0; // one-time costs don't contribute to monthly burn
		default:
			return amount;
	}
}

export function computeDashboard(): DashboardSummary {
	const allProjects = db.select().from(projects).all();
	const activeProjects = allProjects.filter((p) => p.status === 'active');
	const activeCosts = db.select().from(costs).where(eq(costs.active, true)).all();
	const allocations = db.select().from(costAllocations).all();

	const perProject = new Map<number, ProjectRollup>();
	for (const p of allProjects) {
		perProject.set(p.id, {
			project: p,
			directMonthly: 0,
			sharedMonthly: 0,
			globalMonthly: 0,
			totalMonthly: 0,
			lines: []
		});
	}

	let globalMonthlyTotal = 0;
	let sharedMonthlyTotal = 0;
	let projectMonthlyTotal = 0;

	for (const cost of activeCosts) {
		const monthly = cost.monthlyAmount;

		if (cost.scope === 'global') {
			globalMonthlyTotal += monthly;
			if (activeProjects.length === 0) continue;
			const share = 1 / activeProjects.length;
			const per = monthly * share;
			for (const p of activeProjects) {
				const r = perProject.get(p.id)!;
				r.globalMonthly += per;
				r.lines.push({
					costId: cost.id,
					name: cost.name,
					vendor: cost.vendor,
					scope: 'global',
					share,
					amount: per
				});
			}
			continue;
		}

		const allocs = allocations.filter((a) => a.costId === cost.id);
		const totalWeight = allocs.reduce((s, a) => s + a.weight, 0);
		if (totalWeight <= 0) continue;

		if (cost.scope === 'shared') sharedMonthlyTotal += monthly;
		else projectMonthlyTotal += monthly;

		for (const a of allocs) {
			const share = a.weight / totalWeight;
			const per = monthly * share;
			const r = perProject.get(a.projectId);
			if (!r) continue;
			if (cost.scope === 'shared') r.sharedMonthly += per;
			else r.directMonthly += per;
			r.lines.push({
				costId: cost.id,
				name: cost.name,
				vendor: cost.vendor,
				scope: cost.scope,
				share,
				amount: per
			});
		}
	}

	for (const r of perProject.values()) {
		r.totalMonthly = r.directMonthly + r.sharedMonthly + r.globalMonthly;
		r.lines.sort((a, b) => b.amount - a.amount);
	}

	return {
		totalMonthly: globalMonthlyTotal + sharedMonthlyTotal + projectMonthlyTotal,
		globalMonthly: globalMonthlyTotal,
		sharedMonthly: sharedMonthlyTotal,
		projectMonthly: projectMonthlyTotal,
		activeProjects: activeProjects.length,
		activeCosts: activeCosts.length,
		perProject: [...perProject.values()].sort((a, b) => b.totalMonthly - a.totalMonthly)
	};
}

export function computeProjectRollup(projectId: number): ProjectRollup | null {
	const project = db.select().from(projects).where(eq(projects.id, projectId)).get();
	if (!project) return null;
	const summary = computeDashboard();
	return summary.perProject.find((r) => r.project.id === projectId) ?? null;
}

export function setAllocations(
	costId: number,
	allocs: { projectId: number; weight: number }[]
): void {
	db.transaction((tx) => {
		tx.delete(costAllocations).where(eq(costAllocations.costId, costId)).run();
		if (allocs.length === 0) return;
		tx.insert(costAllocations)
			.values(allocs.map((a) => ({ costId, projectId: a.projectId, weight: a.weight })))
			.run();
	});
}

export function getAllocations(costId: number) {
	return db
		.select({
			projectId: costAllocations.projectId,
			weight: costAllocations.weight,
			projectName: projects.name
		})
		.from(costAllocations)
		.innerJoin(projects, eq(projects.id, costAllocations.projectId))
		.where(eq(costAllocations.costId, costId))
		.all();
}

export function singleProjectAllocation(costId: number): number | null {
	const row = db
		.select({ projectId: costAllocations.projectId })
		.from(costAllocations)
		.where(eq(costAllocations.costId, costId))
		.limit(1)
		.get();
	return row?.projectId ?? null;
}

