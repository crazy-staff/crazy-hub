/**
 * crazy-hub's own server functions (decision 13). The hub context rides along with Quackback's
 * bootstrap in the root route: the projects for the navigation, and the signed-in person's roles.
 */
import { createServerFn } from '@tanstack/react-start'
import type { CrazyPermission } from '@/lib/shared/crazy/permissions'
import type { DiscordStatus } from '@/lib/shared/crazy/roles'
import type { HubProject } from '@/lib/shared/crazy/projects'

export interface HubRole {
  slug: string
  name: string
  /** Null for a global role. */
  projectId: string | null
  isPublic: boolean
  /** False while suspended (the role needs Discord with 2FA and the person lacks it). */
  active: boolean
}

export interface HubContext {
  projects: HubProject[]
  me: {
    discord: DiscordStatus
    roles: HubRole[]
    /** Hub-wide permissions (global roles). */
    permissions: CrazyPermission[]
    /** Permissions per project id, global roles included. */
    projectPermissions: Record<string, CrazyPermission[]>
  } | null
}

export const getHubContextFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<HubContext> => {
    const [{ listHubProjects }, { getOptionalHubAccess }, { isAssignmentActive }] =
      await Promise.all([
        import('./projects.service'),
        import('./roles.service'),
        import('@/lib/shared/crazy/roles'),
      ])
    const [projects, access] = await Promise.all([listHubProjects(), getOptionalHubAccess()])
    if (!access) return { projects, me: null }
    return {
      projects,
      me: {
        discord: access.discord,
        roles: access.assignments.map((a) => ({
          slug: a.role.slug,
          name: a.role.name,
          projectId: a.projectId,
          isPublic: a.role.isPublic,
          active: isAssignmentActive(a.role, access.discord),
        })),
        permissions: [...access.permissionsIn(null)],
        projectPermissions: Object.fromEntries(
          projects.map((p) => [p.id, [...access.permissionsIn(p.id)]])
        ),
      },
    }
  }
)
