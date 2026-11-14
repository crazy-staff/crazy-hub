/**
 * Queries and helpers of the admin editors for projects and roles (decision 13, #22).
 */
import { queryOptions } from '@tanstack/react-query'
import { listProjectsAdminFn, listRolesAdminFn } from '@/lib/server/crazy/admin-functions'
import type { CrazyPermission } from '@/lib/shared/crazy/permissions'
import type { DiscordStatus } from '@/lib/shared/crazy/roles'
import { m } from '../paraglide/messages.js'

export const adminQueries = {
  projects: () =>
    queryOptions({
      queryKey: ['crazy', 'admin', 'projects'],
      queryFn: () => listProjectsAdminFn(),
    }),
  roles: () =>
    queryOptions({ queryKey: ['crazy', 'admin', 'roles'], queryFn: () => listRolesAdminFn() }),
}

export type ProjectsAdmin = Awaited<ReturnType<typeof listProjectsAdminFn>>
export type ProjectAdmin = ProjectsAdmin['projects'][number]
export type DimensionAdmin = ProjectAdmin['dimensions'][number]
export type ValueAdmin = DimensionAdmin['values'][number]
export type RolesAdmin = Awaited<ReturnType<typeof listRolesAdminFn>>
export type CategoryAdmin = RolesAdmin['categories'][number]
export type RoleAdmin = CategoryAdmin['roles'][number]
export type PersonAdmin = RolesAdmin['people'][number]

/** Lowercase, dashes for anything else: a slug from a name. */
export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

const ERRORS: Record<string, () => string> = {
  'scope-mismatch': m.error_scope_mismatch,
  'not-allowed': m.error_not_allowed,
  'needs-owner': m.error_needs_owner,
  'discord-missing': m.error_discord_missing,
  'discord-no-mfa': m.error_discord_no_mfa,
  'discord-unknown': m.error_discord_unknown,
  'exclusive-conflict': m.error_exclusive_conflict,
  'already-has': m.error_already_has,
  'slug-taken': m.error_slug_taken,
  'category-not-empty': m.error_category_not_empty,
  'role-is-system': m.error_role_is_system,
  'owner-exists': m.error_owner_exists,
}

/** The message for an error a crazy-hub server function threw (its reason code), or a generic one. */
export function errorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : String(err)
  const reason = Object.keys(ERRORS).find((key) => text.includes(key))
  return reason ? ERRORS[reason]() : m.auth_error_generic()
}

export const PERMISSION_LABEL: Record<CrazyPermission, () => string> = {
  'hub.owner': m.perm_hub_owner,
  'projects.manage': m.perm_projects_manage,
  'roles.manage': m.perm_roles_manage,
  'roles.assign': m.perm_roles_assign,
  'ideas.moderate': m.perm_ideas_moderate,
  'roadmap.manage': m.perm_roadmap_manage,
  'changelog.publish': m.perm_changelog_publish,
  'docs.edit': m.perm_docs_edit,
  'docs.publish': m.perm_docs_publish,
  'downloads.manage': m.perm_downloads_manage,
  'downloads.alpha': m.perm_downloads_alpha,
}

export const DISCORD_LABEL: Record<DiscordStatus, () => string> = {
  ok: m.discord_ok,
  'no-mfa': m.discord_no_mfa,
  'no-discord': m.discord_no_discord,
  unknown: m.discord_unknown,
}

export const DISCORD_CHIP: Record<DiscordStatus, 'success' | 'warning' | 'neutral'> = {
  ok: 'success',
  'no-mfa': 'warning',
  'no-discord': 'neutral',
  unknown: 'neutral',
}
