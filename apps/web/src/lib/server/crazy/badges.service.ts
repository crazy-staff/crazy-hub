/**
 * Public role badges next to people's names (#5, decision 13): a person's roles marked public, global
 * ones and those of the project the page belongs to, in the admin's order (category, then role).
 * A role that needs Discord with 2FA shows only while it is active, as it grants rights only then.
 */
import type { PrincipalId, UserId } from '@quackback/ids'
import {
  and,
  asc,
  crazyRoleAssignments,
  crazyRoleCategories,
  crazyRoles,
  db,
  eq,
  inArray,
  isNull,
  or,
  principal,
} from '@/lib/server/db'
import { isAssignmentActive, type DiscordStatus } from '@/lib/shared/crazy/roles'
import { readDiscordStatus } from './discord-mfa'

export interface RoleBadge {
  slug: string
  name: string
}

/** The most people one page asks about (an idea with a long discussion). */
export const BADGE_PEOPLE_MAX = 200

export async function roleBadges(
  projectId: string | null,
  principalIds: readonly string[]
): Promise<Record<string, RoleBadge[]>> {
  const ids = [...new Set(principalIds)].slice(0, BADGE_PEOPLE_MAX) as PrincipalId[]
  if (ids.length === 0) return {}
  const rows = await db
    .select({
      principalId: crazyRoleAssignments.principalId,
      userId: principal.userId,
      slug: crazyRoles.slug,
      name: crazyRoles.name,
      requiresDiscordMfa: crazyRoles.requiresDiscordMfa,
    })
    .from(crazyRoleAssignments)
    .innerJoin(crazyRoles, eq(crazyRoles.id, crazyRoleAssignments.roleId))
    .innerJoin(crazyRoleCategories, eq(crazyRoleCategories.id, crazyRoles.categoryId))
    .innerJoin(principal, eq(principal.id, crazyRoleAssignments.principalId))
    .where(
      and(
        inArray(crazyRoleAssignments.principalId, ids),
        eq(crazyRoles.isPublic, true),
        projectId
          ? or(
              isNull(crazyRoleAssignments.projectId),
              eq(crazyRoleAssignments.projectId, projectId)
            )
          : isNull(crazyRoleAssignments.projectId)
      )
    )
    .orderBy(asc(crazyRoleCategories.position), asc(crazyRoles.position))

  // Discord status only for the people whose badges depend on it
  const needDiscord = [
    ...new Set(rows.filter((r) => r.requiresDiscordMfa && r.userId).map((r) => r.userId!)),
  ]
  const discord = new Map<string, DiscordStatus>(
    await Promise.all(
      needDiscord.map(
        async (userId) => [userId, (await readDiscordStatus(userId as UserId)).status] as const
      )
    )
  )

  const out: Record<string, RoleBadge[]> = {}
  for (const row of rows) {
    const status = row.userId ? (discord.get(row.userId) ?? 'unknown') : 'unknown'
    if (!isAssignmentActive(row, status)) continue
    const list = (out[row.principalId] ??= [])
    if (!list.some((badge) => badge.slug === row.slug))
      list.push({ slug: row.slug, name: row.name })
  }
  return out
}
