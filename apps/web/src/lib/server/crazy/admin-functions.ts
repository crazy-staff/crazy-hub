/**
 * Server functions of the admin editors for projects, dimensions and roles (decision 13, #22 part 2).
 * Every one checks a hub-wide crazy-hub permission through `requireProjectPermission(null, …)`;
 * Quackback's team role is not enough. The first Owner claims the role (`claimOwnerFn`): a Quackback
 * workspace admin with Discord and 2FA, while nobody holds it.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { PrincipalId } from '@quackback/ids'
import { CRAZY_PERMISSION_KEYS } from '@/lib/shared/crazy/permissions'
import { SECTION_IDS } from '@/lib/shared/crazy/projects'

const slug = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'lowercase letters, digits and dashes')
const name = z.string().trim().min(1).max(80)
const short = z.string().trim().max(3)
const description = z.string().trim().max(200)
const id = z.string().uuid()
const direction = z.union([z.literal(-1), z.literal(1)])
/** One step (`direction`, the arrow buttons) or straight to an index (`to`, drag and drop). */
const move = z
  .object({ id, direction: direction.optional(), to: z.number().int().min(0).max(1000).optional() })
  .refine((m) => (m.direction === undefined) !== (m.to === undefined))
const moveOf = (data: { direction?: -1 | 1; to?: number }) =>
  data.to !== undefined ? { to: data.to } : (data.direction ?? 1)

async function guard(permission: 'projects.manage' | 'roles.manage' | 'roles.assign') {
  const { requireProjectPermission } = await import('./roles.service')
  return requireProjectPermission(null, permission)
}

/** A unique-violation from Postgres, turned into a message the form can show. */
async function unique<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (err) {
    const code =
      (err as { code?: string; cause?: { code?: string } }).code ??
      (err as { cause?: { code?: string } }).cause?.code
    if (code === '23505') throw new Error('slug-taken')
    throw err
  }
}

// ------------------------------------------------------------------------------------ projects

export const listProjectsAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  await guard('projects.manage')
  const { listProjectsAdmin } = await import('./admin.service')
  return listProjectsAdmin()
})

export const createProjectFn = createServerFn({ method: 'POST' })
  .validator(z.object({ slug, name, short, description }))
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { createProject } = await import('./admin.service')
    return unique(() => createProject(data))
  })

export const updateProjectFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id,
      slug: slug.optional(),
      name: name.optional(),
      short: short.optional(),
      description: description.optional(),
      sections: z.array(z.enum(SECTION_IDS)).max(SECTION_IDS.length).optional(),
      buildsRepo: z
        .string()
        .trim()
        .regex(/^[\w.-]+\/[\w.-]+$/, 'owner/name')
        .nullable()
        .optional(),
      archived: z.boolean().optional(),
    })
  )
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { updateProject } = await import('./admin.service')
    const { id: projectId, sections, ...rest } = data
    await unique(() =>
      updateProject(projectId, {
        ...rest,
        ...(sections ? { sections: [...new Set(sections)] } : {}),
      })
    )
  })

export const moveProjectFn = createServerFn({ method: 'POST' })
  .validator(move)
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { moveProject } = await import('./admin.service')
    await moveProject(data.id, moveOf(data))
  })

export const setProjectBoardsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ projectId: id, boardIds: z.array(z.string().uuid()).max(100) }))
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { setProjectBoards } = await import('./admin.service')
    await setProjectBoards(data.projectId, [...new Set(data.boardIds)])
  })

export const createProjectBoardFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      projectId: id,
      name: z.string().trim().min(1).max(100),
      description: z.string().max(500).default(''),
    })
  )
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { createProjectBoard } = await import('./admin.service')
    return createProjectBoard(data.projectId, data)
  })

// ---------------------------------------------------------------------------------- dimensions

export const saveDimensionFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: id.optional(),
      projectId: id,
      slug,
      name,
      usedInDocs: z.boolean(),
      defaultValue: slug.nullable(),
    })
  )
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { saveDimension } = await import('./admin.service')
    return unique(() => saveDimension(data))
  })

export const deleteDimensionFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { deleteDimension } = await import('./admin.service')
    await deleteDimension(data.id)
  })

export const moveDimensionFn = createServerFn({ method: 'POST' })
  .validator(move)
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { moveDimension } = await import('./admin.service')
    await moveDimension(data.id, moveOf(data))
  })

export const saveDimensionValueFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: id.optional(),
      dimensionId: id,
      slug,
      label: name,
      short,
      description,
      status: z.enum(['available', 'planned', 'later']),
    })
  )
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { saveDimensionValue } = await import('./admin.service')
    return unique(() => saveDimensionValue(data))
  })

export const deleteDimensionValueFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { deleteDimensionValue } = await import('./admin.service')
    await deleteDimensionValue(data.id)
  })

export const moveDimensionValueFn = createServerFn({ method: 'POST' })
  .validator(move)
  .handler(async ({ data }) => {
    await guard('projects.manage')
    const { moveDimensionValue } = await import('./admin.service')
    await moveDimensionValue(data.id, moveOf(data))
  })

// ------------------------------------------------------------------------------------- roles

/** Roles and the people holding them; open to whoever may edit roles or give them. */
export const listRolesAdminFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getOptionalHubAccess, ownerExists } = await import('./roles.service')
  const access = await getOptionalHubAccess()
  if (!access) throw new Error('Authentication required')
  const permissions = access.permissionsIn(null)
  const canManage = permissions.has('roles.manage')
  const canAssign = permissions.has('roles.assign')
  const owner = await ownerExists()
  // before the first Owner, a workspace admin sees the page to claim it
  if (!canManage && !canAssign && owner) {
    throw new Error("Access denied: Requires crazy-hub permission 'roles.assign'")
  }
  const { listPeopleWithRoles, listRolesAdmin } = await import('./admin.service')
  const [categories, people] = await Promise.all([
    listRolesAdmin(),
    canAssign || canManage ? listPeopleWithRoles() : Promise.resolve([]),
  ])
  return {
    categories,
    people,
    ownerExists: owner,
    me: { canManage, canAssign, isOwner: permissions.has('hub.owner'), discord: access.discord },
  }
})

export const saveCategoryFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id: id.optional(), slug, name, exclusive: z.boolean() }))
  .handler(async ({ data }) => {
    await guard('roles.manage')
    const { saveCategory } = await import('./admin.service')
    return unique(() => saveCategory(data))
  })

export const deleteCategoryFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    await guard('roles.manage')
    const { deleteCategory } = await import('./admin.service')
    if (!(await deleteCategory(data.id))) throw new Error('category-not-empty')
  })

export const saveRoleFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      id: id.optional(),
      categoryId: id,
      slug,
      name,
      scope: z.enum(['global', 'project']),
      permissions: z.array(z.enum(CRAZY_PERMISSION_KEYS as [string, ...string[]])).max(50),
      isPublic: z.boolean(),
      requiresDiscordMfa: z.boolean(),
    })
  )
  .handler(async ({ data }) => {
    await guard('roles.manage')
    const [{ saveRole }, { sanitizePermissions }] = await Promise.all([
      import('./admin.service'),
      import('@/lib/shared/crazy/permissions'),
    ])
    return unique(() =>
      saveRole({ ...data, permissions: sanitizePermissions(data.permissions, data.scope) })
    )
  })

export const deleteRoleFn = createServerFn({ method: 'POST' })
  .validator(z.object({ id }))
  .handler(async ({ data }) => {
    await guard('roles.manage')
    const { deleteRole } = await import('./admin.service')
    if (!(await deleteRole(data.id))) throw new Error('role-is-system')
  })

// ------------------------------------------------------------------------------------ people

export const searchPeopleFn = createServerFn({ method: 'GET' })
  .validator(z.object({ query: z.string().trim().min(2).max(80) }))
  .handler(async ({ data }) => {
    await guard('roles.assign')
    const { searchPeople } = await import('./admin.service')
    return searchPeople(data.query)
  })

export const grantRoleFn = createServerFn({ method: 'POST' })
  .validator(z.object({ roleId: id, principalId: z.string().min(1), projectId: id.nullable() }))
  .handler(async ({ data }) => {
    const granter = await guard('roles.assign')
    const { grantRole, RoleGrantError } = await import('./roles.service')
    try {
      await grantRole({ ...data, principalId: data.principalId as PrincipalId, granter })
    } catch (err) {
      // the reason is the message the dialog shows
      if (err instanceof RoleGrantError) throw new Error(err.reason)
      throw err
    }
  })

export const revokeRoleFn = createServerFn({ method: 'POST' })
  .validator(z.object({ assignmentId: id }))
  .handler(async ({ data }) => {
    const granter = await guard('roles.assign')
    const { revokeRole } = await import('./roles.service')
    await revokeRole({ granter, assignmentId: data.assignmentId })
  })

/**
 * The first Owner: a Quackback workspace admin claims the Owner role while nobody holds it, with
 * Discord linked and 2FA on (checked live).
 */
export const claimOwnerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { claimOwnerForCaller } = await import('./roles.service')
  const result = await claimOwnerForCaller()
  if (result !== 'ok') throw new Error(result)
})
