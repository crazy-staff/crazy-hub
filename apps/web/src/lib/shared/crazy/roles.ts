/**
 * The rules of the crazy-hub role system (decision 13), as pure functions so the server, the admin UI
 * and the tests share one source:
 *
 * - an assignment is **active** unless its role needs Discord with 2FA and the person's Discord
 *   status isn't `ok` (then it is *suspended*: kept, and active again once fixed);
 * - a person's permissions in a project are those of their active global roles plus their active
 *   roles in that project;
 * - an **exclusive** category allows one of its roles per person: a global role conflicts with any
 *   other role of the category anywhere, a project role with the category's global roles and with
 *   the category's other roles in the same project.
 */
import { sanitizePermissions, type CrazyPermission } from './permissions'

export type RoleScope = 'global' | 'project'

/** Whether a user's linked Discord account has 2FA. */
export type DiscordStatus =
  /** Discord linked and 2FA on. */
  | 'ok'
  /** No Discord account linked. */
  | 'no-discord'
  /** Discord linked, 2FA off. */
  | 'no-mfa'
  /** Discord linked but not checked yet (or the check failed). */
  | 'unknown'

export interface RoleInfo {
  id: string
  slug: string
  name: string
  scope: RoleScope
  categoryId: string
  categoryExclusive: boolean
  permissions: readonly string[]
  isPublic: boolean
  requiresDiscordMfa: boolean
}

export interface Assignment {
  id: string
  role: RoleInfo
  /** Null for a global role. */
  projectId: string | null
}

export function isAssignmentActive(
  role: Pick<RoleInfo, 'requiresDiscordMfa'>,
  discord: DiscordStatus
): boolean {
  return !role.requiresDiscordMfa || discord === 'ok'
}

/** What a person may do in a project (or hub-wide with `projectId` null: global roles only). */
export function effectivePermissions(
  assignments: readonly Assignment[],
  discord: DiscordStatus,
  projectId: string | null
): Set<CrazyPermission> {
  const permissions = new Set<CrazyPermission>()
  for (const assignment of assignments) {
    if (!isAssignmentActive(assignment.role, discord)) continue
    const applies =
      assignment.projectId === null || (projectId !== null && assignment.projectId === projectId)
    if (!applies) continue
    for (const key of sanitizePermissions(assignment.role.permissions, assignment.role.scope)) {
      permissions.add(key)
    }
  }
  return permissions
}

/** The existing assignment that giving `role` (in `projectId`) would break, if any. */
export function exclusivityConflict(
  existing: readonly Assignment[],
  role: RoleInfo,
  projectId: string | null
): Assignment | undefined {
  if (!role.categoryExclusive) return undefined
  return existing.find((assignment) => {
    if (assignment.role.categoryId !== role.categoryId) return false
    if (assignment.role.id === role.id && assignment.projectId === projectId) return false
    if (role.scope === 'global' || assignment.projectId === null) return true
    return assignment.projectId === projectId
  })
}

export type GrantRefusal =
  | 'scope-mismatch'
  | 'not-allowed'
  | 'needs-owner'
  | 'discord-missing'
  | 'discord-no-mfa'
  | 'discord-unknown'
  | 'exclusive-conflict'
  | 'already-has'

/** The seeded roles only an Owner may give or take. */
export const OWNER_ONLY_ROLES = new Set(['owner', 'admin'])

/**
 * Why `granter` may not give `role` to someone (or `null` when it may). `granterPermissions` are the
 * granter's global permissions.
 */
export function grantRefusal(input: {
  granterPermissions: ReadonlySet<CrazyPermission>
  role: RoleInfo
  projectId: string | null
  existing: readonly Assignment[]
  discord: DiscordStatus
}): GrantRefusal | null {
  const { granterPermissions, role, projectId, existing, discord } = input
  if ((role.scope === 'global') !== (projectId === null)) return 'scope-mismatch'
  if (!granterPermissions.has('roles.assign')) return 'not-allowed'
  if (OWNER_ONLY_ROLES.has(role.slug) && !granterPermissions.has('hub.owner')) return 'needs-owner'
  if (existing.some((a) => a.role.id === role.id && a.projectId === projectId)) return 'already-has'
  if (role.requiresDiscordMfa) {
    if (discord === 'no-discord') return 'discord-missing'
    if (discord === 'no-mfa') return 'discord-no-mfa'
    if (discord === 'unknown') return 'discord-unknown'
  }
  if (exclusivityConflict(existing, role, projectId)) return 'exclusive-conflict'
  return null
}

/** Why `granter` may not take `role` away (or `null`). */
export function revokeRefusal(input: {
  granterPermissions: ReadonlySet<CrazyPermission>
  role: RoleInfo
}): 'not-allowed' | 'needs-owner' | null {
  if (!input.granterPermissions.has('roles.assign')) return 'not-allowed'
  if (OWNER_ONLY_ROLES.has(input.role.slug) && !input.granterPermissions.has('hub.owner')) {
    return 'needs-owner'
  }
  return null
}
