import { sqliteTable, text, integer, real, uniqueIndex, index, primaryKey } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
	updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: integer('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull(),
	createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
});

export const projects = sqliteTable('projects', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	status: text('status', { enum: ['active', 'paused', 'archived'] })
		.notNull()
		.default('active'),
	notes: text('notes'),
	createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
	updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
}, (t) => ({
	nameIdx: uniqueIndex('projects_name_idx').on(t.name)
}));

/**
 * scope:
 *   - 'global'  → divided equally across all active projects automatically
 *   - 'shared'  → split across selected projects via cost_allocations.weight
 *   - 'project' → tied to a single project via cost_allocations (one row, weight=1)
 *   - 'tag'     → divided equally across active projects whose tags intersect cost_tags (any-of)
 */
export const costs = sqliteTable('costs', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	vendor: text('vendor'),
	scope: text('scope', { enum: ['global', 'shared', 'project', 'tag'] }).notNull(),
	billingCycle: text('billing_cycle', { enum: ['monthly', 'yearly', 'one_time'] })
		.notNull()
		.default('monthly'),
	amount: real('amount').notNull(),
	monthlyAmount: real('monthly_amount').notNull(),
	currency: text('currency').notNull().default('USD'),
	notes: text('notes'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	startedOn: text('started_on'),
	endedOn: text('ended_on'),
	createdAt: integer('created_at').notNull().default(sql`(unixepoch())`),
	updatedAt: integer('updated_at').notNull().default(sql`(unixepoch())`)
}, (t) => ({
	scopeIdx: index('costs_scope_idx').on(t.scope),
	activeIdx: index('costs_active_idx').on(t.active)
}));

export const costAllocations = sqliteTable('cost_allocations', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	costId: integer('cost_id')
		.notNull()
		.references(() => costs.id, { onDelete: 'cascade' }),
	projectId: integer('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	weight: real('weight').notNull().default(1)
}, (t) => ({
	uniq: uniqueIndex('cost_allocations_cost_project_idx').on(t.costId, t.projectId),
	costIdx: index('cost_allocations_cost_idx').on(t.costId),
	projectIdx: index('cost_allocations_project_idx').on(t.projectId)
}));

export const tags = sqliteTable('tags', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	category: text('category').notNull(),
	createdAt: integer('created_at').notNull().default(sql`(unixepoch())`)
}, (t) => ({
	nameIdx: uniqueIndex('tags_name_idx').on(t.name),
	categoryIdx: index('tags_category_idx').on(t.category)
}));

export const projectTags = sqliteTable('project_tags', {
	projectId: integer('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	tagId: integer('tag_id')
		.notNull()
		.references(() => tags.id, { onDelete: 'cascade' })
}, (t) => ({
	pk: primaryKey({ columns: [t.projectId, t.tagId] }),
	tagIdx: index('project_tags_tag_idx').on(t.tagId)
}));

export const costTags = sqliteTable('cost_tags', {
	costId: integer('cost_id')
		.notNull()
		.references(() => costs.id, { onDelete: 'cascade' }),
	tagId: integer('tag_id')
		.notNull()
		.references(() => tags.id, { onDelete: 'cascade' })
}, (t) => ({
	pk: primaryKey({ columns: [t.costId, t.tagId] }),
	tagIdx: index('cost_tags_tag_idx').on(t.tagId)
}));

export type User = typeof users.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Cost = typeof costs.$inferSelect;
export type CostAllocation = typeof costAllocations.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type ProjectTag = typeof projectTags.$inferSelect;
export type CostTag = typeof costTags.$inferSelect;

export type Scope = Cost['scope'];
export type BillingCycle = Cost['billingCycle'];
export type ProjectStatus = Project['status'];
