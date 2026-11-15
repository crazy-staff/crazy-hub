/** Server functions of idea votes (#5): see `votes.service.ts`. */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const postId = z.string().min(1).max(64)

/** Downvote counts and the viewer's votes for the ideas on screen. */
export const getIdeaVotesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ postIds: z.array(postId).max(200) }))
  .handler(async ({ data }) => {
    const { ideaVotes } = await import('./votes.service')
    const { getOptionalAuth } = await import('@/lib/server/functions/auth-helpers')
    const auth = await getOptionalAuth().catch(() => null)
    const viewer = auth && auth.principal.type !== 'anonymous' ? auth.principal.id : undefined
    return ideaVotes(data.postIds, viewer as never)
  })

/** Press up or down on an idea; returns the viewer's vote and the new score. */
export const voteIdeaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, direction: z.enum(['up', 'down']) }))
  .handler(async ({ data }) => {
    const { voteIdea } = await import('./votes.service')
    return voteIdea(data.postId as never, data.direction)
  })
