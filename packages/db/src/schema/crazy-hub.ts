/**
 * crazy-hub's own tables (decision 13): projects, their dimensions, and the role system that acts
 * inside them. Kept in one file, next to Quackback's schema and never inside it, so upstream merges
 * stay clean. Every table is prefixed `crazy_`; ids are plain UUIDs (no TypeID prefix to register).
 *
 * - A **project** is the hub's main division (`/<slug>/…`). Its ideas are the posts of its boards
 *   (`crazy_project_boards`), and changelog entries are tied to it by `crazy_changelog_projects`.
 * - A **dimension** (trainer: game, renderer) belongs to a project, has values and a default value.
 *   Dimensions double as `kind: value` tag kinds; `used_in_docs` says whether docs vary by it.
 * - A **role** belongs to a category, has a scope (global or per project) and a set of permissions
 *   from the fixed list in code (`apps/web/src/lib/shared/crazy/permissions.ts`). An exclusive
 *   category allows one of its roles per person (counted inside a project).
 * - `crazy_discord_mfa` caches whether a user's linked Discord account has 2FA; roles that require it
 *   are suspended (not deleted) while it is missing.
 */
import { sql } from 'drizzle-orm'
import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { typeIdColumn, typeIdColumnNullable } from '@quackback/ids/drizzle'
import { principal, user } from './auth'
import { boards } from './boards'
import { changelogEntries } from './changelog'

export const CRAZY_SECTIONS = ['ideas', 'roadmap', 'changelog', 'docs', 'downloads'] as const
export type CrazySection = (typeof CRAZY_SECTIONS)[number]

export const CRAZY_VALUE_STATUSES = ['available', 'planned', 'later'] as const
export type CrazyValueStatus = (typeof CRAZY_VALUE_STATUSES)[number]

export const CRAZY_ROLE_SCOPES = ['global', 'project'] as const
export type CrazyRoleScope = (typeof CRAZY_ROLE_SCOPES)[number]

export const crazyProjects = pgTable('crazy_projects', {
  id: uuid('id').defaultRandom().primaryKey(),
  /** The URL segment: `/trainer/…`. */
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** Two letters for the badge. */
  short: text('short').default('').notNull(),
  description: text('description').default('').notNull(),
  position: integer('position').default(0).notNull(),
  /** Enabled sections, in nav order. */
  sections: jsonb('sections')
    .$type<CrazySection[]>()
    .default(sql`'["ideas","roadmap","changelog","docs","downloads"]'::jsonb`)
    .notNull(),
  /** `owner/name` of the private repository the downloads page reads releases from. */
  buildsRepo: text('builds_repo'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
})

export const crazyProjectBoards = pgTable(
  'crazy_project_boards',
  {
    projectId: uuid('project_id')
      .notNull()
      .references(() => crazyProjects.id, { onDelete: 'cascade' }),
    boardId: typeIdColumn('board')('board_id')
      .notNull()
      .references(() => boards.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.projectId, table.boardId] }),
    // A board belongs to one project.
    uniqueIndex('crazy_project_boards_board_idx').on(table.boardId),
  ]
)

export const crazyChangelogProjects = pgTable(
  'crazy_changelog_projects',
  {
    changelogEntryId: typeIdColumn('changelog')('changelog_entry_id').notNull(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => crazyProjects.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({ columns: [table.changelogEntryId, table.projectId] }),
    // Named by hand: the generated name is longer than Postgres' 63 characters.
    foreignKey({
      name: 'crazy_changelog_projects_entry_fk',
      columns: [table.changelogEntryId],
      foreignColumns: [changelogEntries.id],
    }).onDelete('cascade'),
    index('crazy_changelog_projects_project_idx').on(table.projectId),
  ]
)

export const crazyDimensions = pgTable(
  'crazy_dimensions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => crazyProjects.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    position: integer('position').default(0).notNull(),
    /** Docs vary by it (a variant picker group); otherwise it is a tag kind only. */
    usedInDocs: boolean('used_in_docs').default(true).notNull(),
    /** Slug of the value a first visit gets. */
    defaultValue: text('default_value'),
  },
  (table) => [uniqueIndex('crazy_dimensions_project_slug_idx').on(table.projectId, table.slug)]
)

export const crazyDimensionValues = pgTable(
  'crazy_dimension_values',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    dimensionId: uuid('dimension_id')
      .notNull()
      .references(() => crazyDimensions.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    short: text('short').default('').notNull(),
    description: text('description').default('').notNull(),
    status: text('status').$type<CrazyValueStatus>().default('available').notNull(),
    position: integer('position').default(0).notNull(),
  },
  (table) => [
    uniqueIndex('crazy_dimension_values_dimension_slug_idx').on(table.dimensionId, table.slug),
  ]
)

export const crazyRoleCategories = pgTable('crazy_role_categories', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  /** One role from this category per person (inside a project for project roles). */
  exclusive: boolean('exclusive').default(false).notNull(),
  position: integer('position').default(0).notNull(),
})

export const crazyRoles = pgTable(
  'crazy_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => crazyRoleCategories.id, { onDelete: 'restrict' }),
    slug: text('slug').notNull().unique(),
    name: text('name').notNull(),
    scope: text('scope').$type<CrazyRoleScope>().notNull(),
    /** Keys from the fixed permission list in code. Unknown keys are ignored. */
    permissions: jsonb('permissions')
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** Shown as a badge next to the person's name (hub and Discord). */
    isPublic: boolean('is_public').default(true).notNull(),
    /** Only given to, and only active for, accounts with Discord linked and 2FA on. */
    requiresDiscordMfa: boolean('requires_discord_mfa').default(true).notNull(),
    /** Seeded roles the hub relies on (Owner); they can be edited but not deleted. */
    system: boolean('system').default(false).notNull(),
    position: integer('position').default(0).notNull(),
  },
  (table) => [index('crazy_roles_category_idx').on(table.categoryId)]
)

export const crazyRoleAssignments = pgTable(
  'crazy_role_assignments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    roleId: uuid('role_id')
      .notNull()
      .references(() => crazyRoles.id, { onDelete: 'cascade' }),
    principalId: typeIdColumn('principal')('principal_id')
      .notNull()
      .references(() => principal.id, { onDelete: 'cascade' }),
    /** Null for global roles, set for project roles. */
    projectId: uuid('project_id').references(() => crazyProjects.id, { onDelete: 'cascade' }),
    grantedBy: typeIdColumnNullable('principal')('granted_by').references(() => principal.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('crazy_role_assignments_principal_idx').on(table.principalId),
    uniqueIndex('crazy_role_assignments_global_idx')
      .on(table.roleId, table.principalId)
      .where(sql`"project_id" IS NULL`),
    uniqueIndex('crazy_role_assignments_project_idx')
      .on(table.roleId, table.principalId, table.projectId)
      .where(sql`"project_id" IS NOT NULL`),
  ]
)

export const crazyDiscordMfa = pgTable('crazy_discord_mfa', {
  userId: typeIdColumn('user')('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  /** The Discord account the answer is for; a different linked account invalidates it. */
  discordAccountId: text('discord_account_id').notNull(),
  mfaEnabled: boolean('mfa_enabled').notNull(),
  checkedAt: timestamp('checked_at', { withTimezone: true }).defaultNow().notNull(),
  /** `account.updated_at` at check time: a newer value means a new Discord sign-in, so re-check. */
  accountUpdatedAt: timestamp('account_updated_at', { withTimezone: true }),
})
