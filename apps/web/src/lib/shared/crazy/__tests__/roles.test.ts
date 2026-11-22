import { describe, expect, it } from 'vitest'
import { sanitizePermissions } from '../permissions'
import {
  effectivePermissions,
  exclusivityConflict,
  grantRefusal,
  isAssignmentActive,
  revokeRefusal,
  type Assignment,
  type RoleInfo,
} from '../roles'

const team = { categoryId: 'team', categoryExclusive: true }
const role = (over: Partial<RoleInfo> & Pick<RoleInfo, 'id' | 'scope'>): RoleInfo => ({
  slug: over.id,
  name: over.id,
  categoryId: 'misc',
  categoryExclusive: false,
  permissions: [],
  isPublic: true,
  requiresDiscordMfa: true,
  ...over,
})

const owner = role({
  id: 'owner',
  scope: 'global',
  ...team,
  permissions: ['hub.owner', 'roles.assign', 'projects.manage', 'ideas.moderate'],
})
const admin = role({
  id: 'admin',
  scope: 'global',
  ...team,
  permissions: ['roles.assign', 'ideas.moderate'],
})
const moderator = role({
  id: 'moderator',
  scope: 'project',
  ...team,
  permissions: ['ideas.moderate', 'projects.manage'],
})
const editor = role({ id: 'docs-editor', scope: 'project', permissions: ['docs.edit'] })
const rank = role({ id: 'rank', scope: 'global', requiresDiscordMfa: false, permissions: [] })

const holds = (r: RoleInfo, projectId: string | null, id = `${r.id}-${projectId}`): Assignment => ({
  id,
  role: r,
  projectId,
})

describe('sanitizePermissions', () => {
  it('drops unknown keys and hub-wide keys from project roles', () => {
    expect(sanitizePermissions(['ideas.moderate', 'nope', 'projects.manage'], 'project')).toEqual([
      'ideas.moderate',
      'ideas.status',
      'ideas.tags',
      'ideas.delete',
      'ideas.merge',
      'comments.moderate',
    ])
    expect(sanitizePermissions(['projects.manage', 'projects.manage'], 'global')).toEqual([
      'projects.manage',
    ])
  })
})

describe('isAssignmentActive', () => {
  it('suspends roles that need Discord 2FA unless the status is ok', () => {
    expect(isAssignmentActive(moderator, 'ok')).toBe(true)
    expect(isAssignmentActive(moderator, 'no-mfa')).toBe(false)
    expect(isAssignmentActive(moderator, 'no-discord')).toBe(false)
    expect(isAssignmentActive(moderator, 'unknown')).toBe(false)
    expect(isAssignmentActive(rank, 'no-discord')).toBe(true)
  })
})

describe('effectivePermissions', () => {
  const assignments = [holds(moderator, 'trainer'), holds(editor, 'other')]

  it('gives project roles only in their project', () => {
    expect([...effectivePermissions(assignments, 'ok', 'trainer')]).toEqual([
      'ideas.moderate',
      'ideas.status',
      'ideas.tags',
      'ideas.delete',
      'ideas.merge',
      'comments.moderate',
    ])
    expect([...effectivePermissions(assignments, 'ok', 'other')]).toEqual(['docs.edit'])
    expect([...effectivePermissions(assignments, 'ok', null)]).toEqual([])
  })

  it('gives global roles everywhere', () => {
    const perms = effectivePermissions([holds(admin, null)], 'ok', 'trainer')
    expect(perms.has('ideas.moderate')).toBe(true)
    expect(effectivePermissions([holds(admin, null)], 'ok', null).has('roles.assign')).toBe(true)
  })

  it('gives nothing while Discord 2FA is missing', () => {
    expect(effectivePermissions(assignments, 'no-mfa', 'trainer').size).toBe(0)
  })
})

describe('exclusivityConflict', () => {
  it('stops an admin from also being a moderator, anywhere', () => {
    expect(exclusivityConflict([holds(admin, null)], moderator, 'trainer')?.role.id).toBe('admin')
    expect(exclusivityConflict([holds(moderator, 'other')], admin, null)?.role.id).toBe('moderator')
  })

  it('counts project roles inside one project', () => {
    const tester = role({
      id: 'alpha',
      scope: 'project',
      categoryId: 'testing',
      categoryExclusive: true,
    })
    const beta = role({
      id: 'beta',
      scope: 'project',
      categoryId: 'testing',
      categoryExclusive: true,
    })
    expect(exclusivityConflict([holds(tester, 'trainer')], beta, 'other')).toBeUndefined()
    expect(exclusivityConflict([holds(tester, 'trainer')], beta, 'trainer')?.role.id).toBe('alpha')
  })

  it('lets a moderator moderate several projects and ignores open categories', () => {
    expect(exclusivityConflict([holds(moderator, 'trainer')], moderator, 'other')).toBeUndefined()
    expect(exclusivityConflict([holds(editor, 'trainer')], editor, 'other')).toBeUndefined()
  })
})

describe('grantRefusal', () => {
  const ownerPerms = effectivePermissions([holds(owner, null)], 'ok', null)
  const adminPerms = effectivePermissions([holds(admin, null)], 'ok', null)
  const base = { existing: [] as Assignment[], discord: 'ok' as const }

  it('allows an admin to give a project role', () => {
    expect(
      grantRefusal({
        ...base,
        granterPermissions: adminPerms,
        role: moderator,
        projectId: 'trainer',
      })
    ).toBeNull()
  })

  it('needs the Owner for Owner and Admin', () => {
    expect(
      grantRefusal({ ...base, granterPermissions: adminPerms, role: admin, projectId: null })
    ).toBe('needs-owner')
    expect(
      grantRefusal({ ...base, granterPermissions: ownerPerms, role: admin, projectId: null })
    ).toBeNull()
  })

  it('needs Discord with 2FA for roles that ask for it', () => {
    const grant = (discord: 'no-discord' | 'no-mfa' | 'unknown') =>
      grantRefusal({
        granterPermissions: adminPerms,
        role: moderator,
        projectId: 'trainer',
        existing: [],
        discord,
      })
    expect(grant('no-discord')).toBe('discord-missing')
    expect(grant('no-mfa')).toBe('discord-no-mfa')
    expect(grant('unknown')).toBe('discord-unknown')
    expect(
      grantRefusal({
        granterPermissions: adminPerms,
        role: rank,
        projectId: null,
        existing: [],
        discord: 'no-discord',
      })
    ).toBeNull()
  })

  it('refuses a wrong scope, a duplicate, an exclusive conflict and a granter without the right', () => {
    expect(
      grantRefusal({ ...base, granterPermissions: adminPerms, role: moderator, projectId: null })
    ).toBe('scope-mismatch')
    expect(
      grantRefusal({
        ...base,
        existing: [holds(moderator, 'trainer')],
        granterPermissions: adminPerms,
        role: moderator,
        projectId: 'trainer',
      })
    ).toBe('already-has')
    expect(
      grantRefusal({
        ...base,
        existing: [holds(admin, null)],
        granterPermissions: ownerPerms,
        role: moderator,
        projectId: 'trainer',
      })
    ).toBe('exclusive-conflict')
    expect(
      grantRefusal({ ...base, granterPermissions: new Set(), role: editor, projectId: 'trainer' })
    ).toBe('not-allowed')
  })
})

describe('revokeRefusal', () => {
  it('protects Owner and Admin from non-owners', () => {
    const adminPerms = effectivePermissions([holds(admin, null)], 'ok', null)
    expect(revokeRefusal({ granterPermissions: adminPerms, role: owner })).toBe('needs-owner')
    expect(revokeRefusal({ granterPermissions: adminPerms, role: moderator })).toBeNull()
    expect(revokeRefusal({ granterPermissions: new Set(), role: moderator })).toBe('not-allowed')
  })
})
