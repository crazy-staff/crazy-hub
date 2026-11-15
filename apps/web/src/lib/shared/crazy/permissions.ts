/**
 * The fixed list of crazy-hub permissions (decision 13). Roles are edited in the admin, but what a
 * role may do is a set of keys from this list: a permission means something only where code checks
 * it, so every feature adds its own keys here and checks them with `requireProjectPermission`.
 *
 * - `global` permissions act on the whole hub (projects, roles); a project role never carries them.
 * - `project` permissions act inside one project; a global role that holds one has it in every
 *   project.
 */
export const CRAZY_PERMISSIONS = {
  /** Owner only: give or take the Owner and Admin roles, transfer ownership. */
  'hub.owner': { scope: 'global' },
  /** Create, edit and archive projects, their boards and dimensions. */
  'projects.manage': { scope: 'global' },
  /** Create and edit role categories and roles. */
  'roles.manage': { scope: 'global' },
  /** Give and take roles (except Owner and Admin, which need `hub.owner`). */
  'roles.assign': { scope: 'global' },
  /** Change the status of the project's ideas. */
  'ideas.status': { scope: 'project' },
  /** Edit the tags of any idea of the project. */
  'ideas.tags': { scope: 'project' },
  /** Delete (and restore) ideas of the project. */
  'ideas.delete': { scope: 'project' },
  /** Remove and restore comments, pin the official response, lock comments. */
  'comments.moderate': { scope: 'project' },
  /** Legacy umbrella of the four above (seeded roles carry it); expands to them. */
  'ideas.moderate': { scope: 'project' },
  /** Build the project's roadmaps. */
  'roadmap.manage': { scope: 'project' },
  /** Write and publish the project's changelog. */
  'changelog.publish': { scope: 'project' },
  /** Write and edit docs pages (drafts). */
  'docs.edit': { scope: 'project' },
  /** Publish docs pages. */
  'docs.publish': { scope: 'project' },
  /** Hide and pin releases on the downloads page, see download counts. */
  'downloads.manage': { scope: 'project' },
  /** Download alpha builds. */
  'downloads.alpha': { scope: 'project' },
} as const satisfies Record<string, { scope: 'global' | 'project' }>

export type CrazyPermission = keyof typeof CRAZY_PERMISSIONS

export const CRAZY_PERMISSION_KEYS = Object.keys(CRAZY_PERMISSIONS) as CrazyPermission[]

export const isCrazyPermission = (key: string): key is CrazyPermission => key in CRAZY_PERMISSIONS

/** What a legacy key stands for. */
const ALIASES: Partial<Record<CrazyPermission, CrazyPermission[]>> = {
  'ideas.moderate': ['ideas.status', 'ideas.tags', 'ideas.delete', 'comments.moderate'],
}

/** The keys an editor offers (aliases are left out: their parts are listed instead). */
export const EDITABLE_PERMISSION_KEYS = (
  Object.keys(CRAZY_PERMISSIONS) as CrazyPermission[]
).filter((key) => !(key in ALIASES))

/**
 * Keeps the known keys a role of this scope may carry, with aliases expanded; anything else is
 * dropped.
 */
export function sanitizePermissions(
  keys: readonly string[],
  scope: 'global' | 'project'
): CrazyPermission[] {
  const known = keys.filter(isCrazyPermission).flatMap((key) => [key, ...(ALIASES[key] ?? [])])
  const allowed =
    scope === 'global' ? known : known.filter((key) => CRAZY_PERMISSIONS[key].scope === 'project')
  return [...new Set(allowed)]
}
