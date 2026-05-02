import { eq } from 'drizzle-orm';
import { db } from './db';
import {
	costs,
	projects,
	costAllocations,
	projectTags,
	costTags,
	type Cost,
	type Project
} from './db/schema';

export type ProjectRollup = {
	project: Project;
	directMonthly: number;
	sharedMonthly: number;
	globalMonthly: number;
	tagMonthly: number;
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
	tagMonthly: number;
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
	const allProjectTags = db.select().from(projectTags).all();
	const allCostTags = db.select().from(costTags).all();

	// Map projectId → Set<tagId>
	const projectTagMap = new Map<number, Set<number>>();
	for (const pt of allProjectTags) {
		if (!projectTagMap.has(pt.projectId)) projectTagMap.set(pt.projectId, new Set());
		projectTagMap.get(pt.projectId)!.add(pt.tagId);
	}
	// Map costId → tagId[]
	const costTagMap = new Map<number, number[]>();
	for (const ct of allCostTags) {
		if (!costTagMap.has(ct.costId)) costTagMap.set(ct.costId, []);
		costTagMap.get(ct.costId)!.push(ct.tagId);
	}

	const perProject = new Map<number, ProjectRollup>();
	for (const p of allProjects) {
		perProject.set(p.id, {
			project: p,
			directMonthly: 0,
			sharedMonthly: 0,
			globalMonthly: 0,
			tagMonthly: 0,
			totalMonthly: 0,
			lines: []
		});
	}

	let globalMonthlyTotal = 0;
	let sharedMonthlyTotal = 0;
	let projectMonthlyTotal = 0;
	let tagMonthlyTotal = 0;

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

		if (cost.scope === 'tag') {
			const tagIds = costTagMap.get(cost.id) ?? [];
			if (tagIds.length === 0) continue;
			const matched = activeProjects.filter((p) => {
				const set = projectTagMap.get(p.id);
				if (!set) return false;
				return tagIds.some((t) => set.has(t));
			});
			if (matched.length === 0) continue;
			tagMonthlyTotal += monthly;
			const share = 1 / matched.length;
			const per = monthly * share;
			for (const p of matched) {
				const r = perProject.get(p.id)!;
				r.tagMonthly += per;
				r.lines.push({
					costId: cost.id,
					name: cost.name,
					vendor: cost.vendor,
					scope: 'tag',
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
		r.totalMonthly = r.directMonthly + r.sharedMonthly + r.globalMonthly + r.tagMonthly;
		r.lines.sort((a, b) => b.amount - a.amount);
	}

	return {
		totalMonthly:
			globalMonthlyTotal + sharedMonthlyTotal + projectMonthlyTotal + tagMonthlyTotal,
		globalMonthly: globalMonthlyTotal,
		sharedMonthly: sharedMonthlyTotal,
		projectMonthly: projectMonthlyTotal,
		tagMonthly: tagMonthlyTotal,
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

export function setCostTags(costId: number, tagIds: number[]): void {
	db.transaction((tx) => {
		tx.delete(costTags).where(eq(costTags.costId, costId)).run();
		if (tagIds.length === 0) return;
		tx.insert(costTags)
			.values(tagIds.map((tagId) => ({ costId, tagId })))
			.run();
	});
}

export function setProjectTags(projectId: number, tagIds: number[]): void {
	db.transaction((tx) => {
		tx.delete(projectTags).where(eq(projectTags.projectId, projectId)).run();
		if (tagIds.length === 0) return;
		tx.insert(projectTags)
			.values(tagIds.map((tagId) => ({ projectId, tagId })))
			.run();
	});
}

export function getCostTags(costId: number): number[] {
	return db
		.select({ tagId: costTags.tagId })
		.from(costTags)
		.where(eq(costTags.costId, costId))
		.all()
		.map((r) => r.tagId);
}

export function getProjectTags(projectId: number): number[] {
	return db
		.select({ tagId: projectTags.tagId })
		.from(projectTags)
		.where(eq(projectTags.projectId, projectId))
		.all()
		.map((r) => r.tagId);
}

export type CostIssueType =
	| 'project_orphan'
	| 'shared_no_allocs'
	| 'tag_no_tags'
	| 'tag_no_match'
	| 'global_no_active_projects';

export type CostIssue = {
	type: CostIssueType;
	severity: 'error' | 'warning';
	costId: number;
	costName: string;
	monthly: number;
	currency: string;
	scope: Cost['scope'];
	active: boolean;
	message: string;
};

/**
 * Find cost records whose configuration is broken — e.g. project deleted out
 * from under a project-scoped cost, all tags removed from a tag-scoped cost,
 * etc. Includes inactive costs so users can clean up before re-activating.
 */
export function findCostIssues(): CostIssue[] {
	const allCosts = db.select().from(costs).all();
	const allocations = db.select().from(costAllocations).all();
	const allProjects = db.select().from(projects).all();
	const allProjectTags = db.select().from(projectTags).all();
	const allCostTags = db.select().from(costTags).all();

	const activeProjectIds = new Set(
		allProjects.filter((p) => p.status === 'active').map((p) => p.id)
	);
	const projectTagMap = new Map<number, Set<number>>();
	for (const pt of allProjectTags) {
		if (!projectTagMap.has(pt.projectId)) projectTagMap.set(pt.projectId, new Set());
		projectTagMap.get(pt.projectId)!.add(pt.tagId);
	}
	const allocsByCost = new Map<number, number>();
	for (const a of allocations) {
		allocsByCost.set(a.costId, (allocsByCost.get(a.costId) ?? 0) + 1);
	}
	const tagsByCost = new Map<number, number[]>();
	for (const ct of allCostTags) {
		if (!tagsByCost.has(ct.costId)) tagsByCost.set(ct.costId, []);
		tagsByCost.get(ct.costId)!.push(ct.tagId);
	}

	const hasActiveGlobal = allCosts.some((c) => c.active && c.scope === 'global');
	const issues: CostIssue[] = [];

	for (const c of allCosts) {
		const base = {
			costId: c.id,
			costName: c.name,
			monthly: c.monthlyAmount,
			currency: c.currency,
			scope: c.scope,
			active: c.active
		};

		if (c.scope === 'project' && (allocsByCost.get(c.id) ?? 0) === 0) {
			issues.push({
				...base,
				type: 'project_orphan',
				severity: 'error',
				message: 'Project-scoped cost has no project — likely the project was deleted.'
			});
		} else if (c.scope === 'shared' && (allocsByCost.get(c.id) ?? 0) === 0) {
			issues.push({
				...base,
				type: 'shared_no_allocs',
				severity: 'error',
				message: 'Shared cost has no project allocations.'
			});
		} else if (c.scope === 'tag') {
			const tagIds = tagsByCost.get(c.id) ?? [];
			if (tagIds.length === 0) {
				issues.push({
					...base,
					type: 'tag_no_tags',
					severity: 'error',
					message: 'Tag-scoped cost has no tags — likely all tags were deleted.'
				});
			} else {
				const tagSet = new Set(tagIds);
				const matched = [...activeProjectIds].some((pid) => {
					const projTags = projectTagMap.get(pid);
					if (!projTags) return false;
					for (const t of tagSet) if (projTags.has(t)) return true;
					return false;
				});
				if (!matched) {
					issues.push({
						...base,
						type: 'tag_no_match',
						severity: 'warning',
						message:
							'Tag-scoped cost matches no active projects. Tag a project, or activate one already tagged.'
					});
				}
			}
		}
	}

	if (hasActiveGlobal && activeProjectIds.size === 0) {
		// Surface as a single synthetic issue, not per-cost noise.
		issues.unshift({
			type: 'global_no_active_projects',
			severity: 'warning',
			costId: 0,
			costName: 'Global costs',
			monthly: 0,
			currency: 'USD',
			scope: 'global',
			active: true,
			message: 'No active projects exist — global costs will not be allocated to anyone.'
		});
	}

	return issues.sort((a, b) => {
		if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
		return b.monthly - a.monthly;
	});
}
