/** Server functions of public profiles: see `profile-activity.service.ts`. */
import { createServerFn } from '@tanstack/react-start'
import { isValidTypeId, type PrincipalId } from '@quackback/ids'
import { z } from 'zod'

/** A person's recent ideas, comments and replies as the caller may see them. */
export const getProfileActivityFn = createServerFn({ method: 'GET' })
  .validator(
    z.object({ principalId: z.string().max(64), before: z.string().datetime().optional() })
  )
  .handler(async ({ data }) => {
    const empty = { commentCount: 0, items: [], next: null }
    if (!isValidTypeId(data.principalId, 'principal')) return empty
    const { resolvePortalAccessForRequest } = await import('@/lib/server/functions/portal-access')
    if (!(await resolvePortalAccessForRequest()).granted) return empty
    const [{ getOptionalAuth, policyActorFromAuth }, { profileActivity }] = await Promise.all([
      import('@/lib/server/functions/auth-helpers'),
      import('./profile-activity.service'),
    ])
    const actor = await policyActorFromAuth(await getOptionalAuth())
    return profileActivity(data.principalId as PrincipalId, actor, data.before)
  })
