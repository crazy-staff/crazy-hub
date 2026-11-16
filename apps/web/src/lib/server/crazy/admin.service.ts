/**
 * The admin side of crazy-hub's projects and roles (decision 13, #22 part 2): full reads for the
 * editors and the writes behind them. Every caller checks its permission first (see
 * `admin-functions.ts`); nothing here checks access.
 */
import type { BoardId, PrincipalId } from '@quackback/ids'
import {
  and,
  asc,
  boards,
  crazyDimensions,
  crazyDimensionValues,
  crazyProjectBoards,
  crazyProjects,
  crazyRoleAssignments,
  crazyRoleCategories,
  crazyRoles,
  db,
  eq,
  ilike,
  inArray,
  isNull,
  ne,
  or,
  principal,
  user,
  type CrazyRoleScope,
  type CrazySection,
  type CrazyValueStatus,
} from '@/lib/server/db'
import type { DiscordStatus } from '@/lib/shared/crazy/roles'
import { readDiscordStatus } from './discord-mfa'

// ------------------------------------------------------------------------------------ projects

export async function listProjectsAdmin() {
  const [projects, links, dimensions, values, boardRows] = await Promise.all([
    db.select().from(crazyProjects).orderBy(asc(crazyProjects.position), asc(crazyProjects.name)),
    db.select().from(crazyProjectBoards),
    db.select().from(crazyDimensions).orderBy(asc(crazyDimensions.position)),
    db.select().from(crazyDimensionValues).orderBy(asc(crazyDimensionValues.position)),
    db
      .select({ id: boards.id, name: boards.name, slug: boards.slug })
      .from(boards)
      .where(isNull(boards.deletedAt))
      .orderBy(asc(boards.name)),
  ])
  return {
    projects: projects.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      short: p.short,
      description: p.description,
      position: p.position,
      sections: p.sections,
      buildsRepo: p.buildsRepo,
      archived: p.archivedAt !== null,
      boardIds: links.filter((l) => l.projectId === p.id).map((l) => l.boardId as string),
      dimensions: dimensions
        .filter((d) => d.projectId === p.id)
        .map((d) => ({
          id: d.id,
          slug: d.slug,
          name: d.name,
          usedInDocs: d.usedInDocs,
          defaultValue: d.defaultValue,
          values: values
            .filter((v) => v.dimensionId === d.id)
            .map((v) => ({
              id: v.id,
              slug: v.slug,
              label: v.label,
              short: v.short,
              description: v.description,
              status: v.status,
            })),
        })),
    })),
    boards: boardRows.map((b) => ({
      id: b.id as string,
      name: b.name,
      slug: b.slug,
      projectId: links.find((l) => l.boardId === b.id)?.projectId ?? null,
    })),
  }
}

export type ProjectsAdmin = Awaited<ReturnType<typeof listProjectsAdmin>>

export async function createProject(input: {
  slug: string
  name: string
  short: string
  description: string
}) {
  const all = await db.select({ position: crazyProjects.position }).from(crazyProjects)
  const position = Math.max(-1, ...all.map((p) => p.position)) + 1
  const [row] = await db
    .insert(crazyProjects)
    .values({ ...input, position })
    .returning({ id: crazyProjects.id })
  return row
}

export async function updateProject(
  id: string,
  input: Partial<{
    slug: string
    name: string
    short: string
    description: string
    sections: CrazySection[]
    buildsRepo: string | null
    archived: boolean
  }>
) {
  const { archived, ...rest } = input
  await db
    .update(crazyProjects)
    .set({
      ...rest,
      ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }),
    })
    .where(eq(crazyProjects.id, id))
}

/** Moves a project one place up or down in the nav. */
export async function moveProject(id: string, move: Move) {
  const rows = await db
    .select({ id: crazyProjects.id })
    .from(crazyProjects)
    .orderBy(asc(crazyProjects.position), asc(crazyProjects.name))
  await reorder(rows, id, move, (rowId, position) =>
    db.update(crazyProjects).set({ position }).where(eq(crazyProjects.id, rowId))
  )
}

/** The project's boards become exactly `boardIds` (a board moves over from another project). */
export async function setProjectBoards(projectId: string, boardIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(crazyProjectBoards).where(eq(crazyProjectBoards.projectId, projectId))
    if (boardIds.length === 0) return
    await tx
      .delete(crazyProjectBoards)
      .where(inArray(crazyProjectBoards.boardId, boardIds as BoardId[]))
    await tx
      .insert(crazyProjectBoards)
      .values(boardIds.map((boardId) => ({ projectId, boardId: boardId as BoardId })))
  })
}

// ---------------------------------------------------------------------------------- dimensions

export async function saveDimension(input: {
  id?: string
  projectId: string
  slug: string
  name: string
  usedInDocs: boolean
  defaultValue: string | null
}) {
  const { id, ...data } = input
  if (id) {
    await db.update(crazyDimensions).set(data).where(eq(crazyDimensions.id, id))
    return { id }
  }
  const siblings = await db
    .select({ position: crazyDimensions.position })
    .from(crazyDimensions)
    .where(eq(crazyDimensions.projectId, input.projectId))
  const position = Math.max(-1, ...siblings.map((s) => s.position)) + 1
  const [row] = await db
    .insert(crazyDimensions)
    .values({ ...data, position })
    .returning({ id: crazyDimensions.id })
  return row
}

export async function deleteDimension(id: string) {
  await db.delete(crazyDimensions).where(eq(crazyDimensions.id, id))
}

export async function moveDimension(id: string, move: Move) {
  const [dimension] = await db
    .select({ projectId: crazyDimensions.projectId })
    .from(crazyDimensions)
    .where(eq(crazyDimensions.id, id))
  if (!dimension) return
  const rows = await db
    .select({ id: crazyDimensions.id })
    .from(crazyDimensions)
    .where(eq(crazyDimensions.projectId, dimension.projectId))
    .orderBy(asc(crazyDimensions.position))
  await reorder(rows, id, move, (rowId, position) =>
    db.update(crazyDimensions).set({ position }).where(eq(crazyDimensions.id, rowId))
  )
}

export async function saveDimensionValue(input: {
  id?: string
  dimensionId: string
  slug: string
  label: string
  short: string
  description: string
  status: CrazyValueStatus
}) {
  const { id, ...data } = input
  if (id) {
    await db.update(crazyDimensionValues).set(data).where(eq(crazyDimensionValues.id, id))
    return { id }
  }
  const siblings = await db
    .select({ position: crazyDimensionValues.position })
    .from(crazyDimensionValues)
    .where(eq(crazyDimensionValues.dimensionId, input.dimensionId))
  const position = Math.max(-1, ...siblings.map((s) => s.position)) + 1
  const [row] = await db
    .insert(crazyDimensionValues)
    .values({ ...data, position })
    .returning({ id: crazyDimensionValues.id })
  return row
}

export async function deleteDimensionValue(id: string) {
  await db.delete(crazyDimensionValues).where(eq(crazyDimensionValues.id, id))
}

export async function moveDimensionValue(id: string, move: Move) {
  const [value] = await db
    .select({ dimensionId: crazyDimensionValues.dimensionId })
    .from(crazyDimensionValues)
    .where(eq(crazyDimensionValues.id, id))
  if (!value) return
  const rows = await db
    .select({ id: crazyDimensionValues.id })
    .from(crazyDimensionValues)
    .where(eq(crazyDimensionValues.dimensionId, value.dimensionId))
    .orderBy(asc(crazyDimensionValues.position))
  await reorder(rows, id, move, (rowId, position) =>
    db.update(crazyDimensionValues).set({ position }).where(eq(crazyDimensionValues.id, rowId))
  )
}

/**
 * Where a row goes: one step up or down (`-1`/`1`, the arrow buttons) or straight to an index
 * (`{ to }`, drag and drop).
 */
export type Move = -1 | 1 | { to: number }

/** Moves a row (one step or to an index) and renumbers the list 0…n. */
async function reorder(
  rows: { id: string }[],
  id: string,
  move: Move,
  write: (id: string, position: number) => Promise<unknown>
) {
  const ids = rows.map((r) => r.id)
  const from = ids.indexOf(id)
  const to = typeof move === 'number' ? from + move : move.to
  if (from < 0 || to < 0 || to >= ids.length || to === from) return
  ids.splice(to, 0, ...ids.splice(from, 1))
  await Promise.all(ids.map((rowId, position) => write(rowId, position)))
}

// ------------------------------------------------------------------------------------- roles

export async function listRolesAdmin() {
  const [categories, roles, counts] = await Promise.all([
    db.select().from(crazyRoleCategories).orderBy(asc(crazyRoleCategories.position)),
    db.select().from(crazyRoles).orderBy(asc(crazyRoles.position), asc(crazyRoles.name)),
    db.select({ roleId: crazyRoleAssignments.roleId }).from(crazyRoleAssignments),
  ])
  return categories.map((c) => ({
    id: c.id,
    slug: c.slug,
    name: c.name,
    exclusive: c.exclusive,
    roles: roles
      .filter((r) => r.categoryId === c.id)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        scope: r.scope,
        permissions: r.permissions,
        isPublic: r.isPublic,
        requiresDiscordMfa: r.requiresDiscordMfa,
        system: r.system,
        holders: counts.filter((a) => a.roleId === r.id).length,
      })),
  }))
}

export type RolesAdmin = Awaited<ReturnType<typeof listRolesAdmin>>

export async function saveCategory(input: {
  id?: string
  slug: string
  name: string
  exclusive: boolean
}) {
  const { id, ...data } = input
  if (id) {
    await db.update(crazyRoleCategories).set(data).where(eq(crazyRoleCategories.id, id))
    return { id }
  }
  const all = await db.select({ position: crazyRoleCategories.position }).from(crazyRoleCategories)
  const [row] = await db
    .insert(crazyRoleCategories)
    .values({ ...data, position: Math.max(-1, ...all.map((c) => c.position)) + 1 })
    .returning({ id: crazyRoleCategories.id })
  return row
}

/** Deletes an empty category; false when it still has roles. */
export async function deleteCategory(id: string) {
  const [role] = await db
    .select({ id: crazyRoles.id })
    .from(crazyRoles)
    .where(eq(crazyRoles.categoryId, id))
    .limit(1)
  if (role) return false
  await db.delete(crazyRoleCategories).where(eq(crazyRoleCategories.id, id))
  return true
}

export async function saveRole(input: {
  id?: string
  categoryId: string
  slug: string
  name: string
  scope: CrazyRoleScope
  permissions: string[]
  isPublic: boolean
  requiresDiscordMfa: boolean
}) {
  const { id, ...data } = input
  if (id) {
    const [current] = await db
      .select({ system: crazyRoles.system })
      .from(crazyRoles)
      .where(eq(crazyRoles.id, id))
    // a seeded role keeps its slug and scope, the code relies on them
    const set = current?.system ? { ...data, slug: undefined, scope: undefined } : data
    await db.update(crazyRoles).set(set).where(eq(crazyRoles.id, id))
    return { id }
  }
  const siblings = await db
    .select({ position: crazyRoles.position })
    .from(crazyRoles)
    .where(eq(crazyRoles.categoryId, input.categoryId))
  const [row] = await db
    .insert(crazyRoles)
    .values({ ...data, position: Math.max(-1, ...siblings.map((r) => r.position)) + 1 })
    .returning({ id: crazyRoles.id })
  return row
}

/** Deletes a role and its assignments; seeded (system) roles stay. */
export async function deleteRole(id: string) {
  const deleted = await db
    .delete(crazyRoles)
    .where(and(eq(crazyRoles.id, id), eq(crazyRoles.system, false)))
    .returning({ id: crazyRoles.id })
  return deleted.length > 0
}

// ------------------------------------------------------------------------------------ people

export interface PersonRow {
  principalId: string
  name: string
  email: string | null
  avatarUrl: string | null
  discord: DiscordStatus
}

async function withDiscord(
  rows: {
    principalId: string
    userId: string | null
    name: string | null
    email: string | null
    image: string | null
    avatarUrl: string | null
  }[]
): Promise<PersonRow[]> {
  return Promise.all(
    rows.map(async (r) => ({
      principalId: r.principalId,
      name: r.name || r.email || '—',
      email: r.email,
      avatarUrl: r.avatarUrl ?? r.image,
      discord: r.userId
        ? (await readDiscordStatus(r.userId as never)).status
        : ('no-discord' as DiscordStatus),
    }))
  )
}

const personColumns = {
  principalId: principal.id,
  userId: principal.userId,
  name: user.name,
  email: user.email,
  image: user.image,
  avatarUrl: principal.avatarUrl,
}

/** Everyone holding a role, with their roles. */
export async function listPeopleWithRoles() {
  const assignments = await db
    .select({
      id: crazyRoleAssignments.id,
      roleId: crazyRoleAssignments.roleId,
      projectId: crazyRoleAssignments.projectId,
      principalId: crazyRoleAssignments.principalId,
      createdAt: crazyRoleAssignments.createdAt,
    })
    .from(crazyRoleAssignments)
    .orderBy(asc(crazyRoleAssignments.createdAt))
  const principalIds = [...new Set(assignments.map((a) => a.principalId as string))]
  if (principalIds.length === 0) return []
  const people = await withDiscord(
    await db
      .select(personColumns)
      .from(principal)
      .leftJoin(user, eq(user.id, principal.userId))
      .where(inArray(principal.id, principalIds as PrincipalId[]))
  )
  return people
    .map((person) => ({
      ...person,
      assignments: assignments
        .filter((a) => a.principalId === person.principalId)
        .map((a) => ({ id: a.id, roleId: a.roleId, projectId: a.projectId })),
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export type PeopleWithRoles = Awaited<ReturnType<typeof listPeopleWithRoles>>

/** Signed-up people (not anonymous, not service principals) whose name or email matches. */
export async function searchPeople(query: string) {
  const term = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
  const rows = await db
    .select(personColumns)
    .from(principal)
    .innerJoin(user, eq(user.id, principal.userId))
    .where(
      and(ne(principal.type, 'anonymous'), or(ilike(user.name, term), ilike(user.email, term)))
    )
    .orderBy(asc(user.name))
    .limit(10)
  return withDiscord(rows)
}

/**
 * A new board for a project, made in the project's Boards tab (owner's note: boards could only be
 * linked, not created, in the new admin). Quackback's own `createBoard` makes it (slug from the
 * name, its validation and limits); then it is linked to the project.
 */
export async function createProjectBoard(
  projectId: string,
  input: { name: string; description: string }
) {
  const { createBoard } = await import('@/lib/server/domains/boards/board.service')
  const board = await createBoard({
    name: input.name.trim(),
    description: input.description.trim() || null,
  })
  await db
    .insert(crazyProjectBoards)
    .values({ projectId, boardId: board.id as BoardId })
    .onConflictDoNothing()
  return { id: board.id as string, slug: board.slug }
}
