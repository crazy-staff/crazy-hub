/**
 * crazy-hub's role system on the server (decision 13): who holds which role, what that lets them do
 * in a project, and the guard every per-project action goes through.
 *
 * Quackback's own server functions check only the workspace role (admin / member / user), so a
 * moderator of one project must never get Quackback's team role. Per-project rights are checked here
 * (`requireProjectPermission`) by our server functions, which then call Quackback's services.
 */
import type { PrincipalId, UserId } from '@quackback/ids'
import {
  and,
  crazyRoleAssignments,
  crazyRoleCategories,
  crazyRoles,
  db,
  eq,
  isNull,
  principal,
} from '@/lib/server/db'
import { logger } from '@/lib/server/logger'
import { memoizePerRequest, forgetPerRequestPrefix } from '@/lib/server/request-memo'
import type { CrazyPermission } from '@/lib/shared/crazy/permissions'
import {
  effectivePermissions,
  grantRefusal,
  revokeRefusal,
  type Assignment,
  type DiscordStatus,
  type GrantRefusal,
  type RoleInfo,
} from '@/lib/shared/crazy/roles'
import { readDiscordStatus, refreshDiscordStatus } from './discord-mfa'

const log = logger.child({ component: 'crazy-roles' })
const MEMO_PREFIX = 'crazy-access:'

const roleColumns = {
  id: crazyRoles.id,
  slug: crazyRoles.slug,
  name: crazyRoles.name,
  scope: crazyRoles.scope,
  categoryId: crazyRoles.categoryId,
  categoryExclusive: crazyRoleCategories.exclusive,
  permissions: crazyRoles.permissions,
  isPublic: crazyRoles.isPublic,
  requiresDiscordMfa: crazyRoles.requiresDiscordMfa,
}

export async function getRole(roleId: string): Promise<RoleInfo | null> {
  const [row] = await db
    .select(roleColumns)
    .from(crazyRoles)
    .innerJoin(crazyRoleCategories, eq(crazyRoleCategories.id, crazyRoles.categoryId))
    .where(eq(crazyRoles.id, roleId))
    .limit(1)
  return row ?? null
}

export async function listAssignments(principalId: PrincipalId): Promise<Assignment[]> {
  const rows = await db
    .select({
      id: crazyRoleAssignments.id,
      projectId: crazyRoleAssignments.projectId,
      role: roleColumns,
    })
    .from(crazyRoleAssignments)
    .innerJoin(crazyRoles, eq(crazyRoles.id, crazyRoleAssignments.roleId))
    .innerJoin(crazyRoleCategories, eq(crazyRoleCategories.id, crazyRoles.categoryId))
    .where(eq(crazyRoleAssignments.principalId, principalId))
  return rows
}

export interface HubAccess {
  assignments: Assignment[]
  discord: DiscordStatus
  /** Permissions in a project (global roles included), or hub-wide with `null`. */
  permissionsIn(projectId: string | null): Set<CrazyPermission>
}

/**
 * A person's roles and Discord status, read once per request. A stale Discord answer is refreshed in
 * the background for people whose roles depend on it; the fresh answer applies from the next request.
 */
export function getHubAccess(principalId: PrincipalId, userId: UserId): Promise<HubAccess> {
  return memoizePerRequest(`${MEMO_PREFIX}${principalId}`, async () => {
    const [assignments, discord] = await Promise.all([
      listAssignments(principalId),
      readDiscordStatus(userId),
    ])
    if (discord.stale && assignments.some((a) => a.role.requiresDiscordMfa)) {
      refreshDiscordStatus(userId).catch((err) =>
        log.warn({ err, user_id: userId }, 'background Discord 2FA check failed')
      )
    }
    return {
      assignments,
      discord: discord.status,
      permissionsIn: (projectId) => effectivePermissions(assignments, discord.status, projectId),
    }
  })
}

/** The signed-in caller's access, or null for a visitor. */
export async function getOptionalHubAccess(): Promise<
  (HubAccess & { principalId: PrincipalId; userId: UserId }) | null
> {
  const { getOptionalAuth } = await import('@/lib/server/functions/auth-helpers')
  const auth = await getOptionalAuth()
  if (!auth) return null
  const access = await getHubAccess(auth.principal.id, auth.user.id)
  return { ...access, principalId: auth.principal.id, userId: auth.user.id }
}

/**
 * The guard of every per-project action: throws `Authentication required` for a visitor and
 * `Access denied: …` when the caller lacks `permission` in `projectId` (null: hub-wide).
 */
export async function requireProjectPermission(
  projectId: string | null,
  permission: CrazyPermission
) {
  const access = await getOptionalHubAccess()
  if (!access) throw new Error('Authentication required')
  if (!access.permissionsIn(projectId).has(permission)) {
    throw new Error(
      `Access denied: Requires crazy-hub permission '${permission}'${projectId ? ` in project ${projectId}` : ''}`
    )
  }
  return access
}

export class RoleGrantError extends Error {
  constructor(readonly reason: GrantRefusal | 'unknown-role' | 'unknown-person') {
    super(`Access denied: cannot give the role (${reason})`)
  }
}

async function userOf(principalId: PrincipalId): Promise<UserId | null> {
  const [row] = await db
    .select({ userId: principal.userId })
    .from(principal)
    .where(eq(principal.id, principalId))
    .limit(1)
  return (row?.userId as UserId | null) ?? null
}

/** Gives a role. Discord 2FA of the person is checked live before the rules are applied. */
export async function grantRole(input: {
  granter: HubAccess & { principalId: PrincipalId }
  roleId: string
  principalId: PrincipalId
  projectId: string | null
}) {
  const role = await getRole(input.roleId)
  if (!role) throw new RoleGrantError('unknown-role')
  const userId = await userOf(input.principalId)
  if (!userId) throw new RoleGrantError('unknown-person')
  const [existing, discord] = await Promise.all([
    listAssignments(input.principalId),
    role.requiresDiscordMfa ? refreshDiscordStatus(userId) : Promise.resolve<DiscordStatus>('ok'),
  ])
  const refusal = grantRefusal({
    granterPermissions: input.granter.permissionsIn(null),
    role,
    projectId: input.projectId,
    existing,
    discord,
  })
  if (refusal) throw new RoleGrantError(refusal)
  const [row] = await db
    .insert(crazyRoleAssignments)
    .values({
      roleId: role.id,
      principalId: input.principalId,
      projectId: input.projectId,
      grantedBy: input.granter.principalId,
    })
    .returning()
  forgetPerRequestPrefix(MEMO_PREFIX)
  log.info(
    { role: role.slug, principal_id: input.principalId, project_id: input.projectId },
    'role given'
  )
  return row
}

export async function revokeRole(input: { granter: HubAccess; assignmentId: string }) {
  const [assignment] = await db
    .select({ id: crazyRoleAssignments.id, roleId: crazyRoleAssignments.roleId })
    .from(crazyRoleAssignments)
    .where(eq(crazyRoleAssignments.id, input.assignmentId))
    .limit(1)
  if (!assignment) return false
  const role = await getRole(assignment.roleId)
  if (!role) return false
  const refusal = revokeRefusal({ granterPermissions: input.granter.permissionsIn(null), role })
  if (refusal) throw new Error(`Access denied: cannot take the role (${refusal})`)
  await db.delete(crazyRoleAssignments).where(eq(crazyRoleAssignments.id, assignment.id))
  forgetPerRequestPrefix(MEMO_PREFIX)
  return true
}

/** Whether anyone holds the Owner role yet (the first Owner claims it, part 2 of #22). */
export async function ownerExists(): Promise<boolean> {
  const [row] = await db
    .select({ id: crazyRoleAssignments.id })
    .from(crazyRoleAssignments)
    .innerJoin(crazyRoles, eq(crazyRoles.id, crazyRoleAssignments.roleId))
    .where(and(eq(crazyRoles.slug, 'owner'), isNull(crazyRoleAssignments.projectId)))
    .limit(1)
  return Boolean(row)
}
