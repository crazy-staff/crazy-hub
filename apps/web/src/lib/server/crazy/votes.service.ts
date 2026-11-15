/**
 * Up- and downvotes of ideas (#5). Upvotes stay Quackback's (`post_votes`, `posts.vote_count`,
 * changed only through its own `runToggleVote`, so subscriptions and events keep working);
 * downvotes live in `crazy_post_downvotes`. One vote per person: a downvote replaces the upvote and
 * the other way round (`applyVote`). The score shown is upvotes minus downvotes; Quackback's
 * `vote_count` never goes below zero and is not touched by downvotes.
 */
import type { PostId, PrincipalId } from '@quackback/ids'
import { and, crazyPostDownvotes, db, eq, inArray, posts, postVotes, sql } from '@/lib/server/db'
import { applyVote, ideaScore, type IdeaVote } from '@/lib/shared/crazy/votes'

export interface IdeaVotes {
  /** Upvotes per post id (Quackback's `vote_count`, fresher than a cached list page). */
  up: Record<string, number>
  /** Downvotes per post id (posts without any are left out). */
  down: Record<string, number>
  /** The viewer's vote per post id (posts without one are left out). */
  mine: Record<string, 'up' | 'down'>
}

/** Downvote counts of `postIds` and the viewer's own votes on them. */
export async function ideaVotes(postIds: string[], viewer?: PrincipalId): Promise<IdeaVotes> {
  const ids = [...new Set(postIds)] as PostId[]
  if (ids.length === 0) return { up: {}, down: {}, mine: {} }
  const [upvotes, counts, ups, downs] = await Promise.all([
    db.select({ postId: posts.id, n: posts.voteCount }).from(posts).where(inArray(posts.id, ids)),
    db
      .select({ postId: crazyPostDownvotes.postId, n: sql<number>`count(*)::int` })
      .from(crazyPostDownvotes)
      .where(inArray(crazyPostDownvotes.postId, ids))
      .groupBy(crazyPostDownvotes.postId),
    viewer
      ? db
          .select({ postId: postVotes.postId })
          .from(postVotes)
          .where(and(eq(postVotes.principalId, viewer), inArray(postVotes.postId, ids)))
      : [],
    viewer
      ? db
          .select({ postId: crazyPostDownvotes.postId })
          .from(crazyPostDownvotes)
          .where(
            and(eq(crazyPostDownvotes.principalId, viewer), inArray(crazyPostDownvotes.postId, ids))
          )
      : [],
  ])
  const up: Record<string, number> = {}
  for (const row of upvotes) up[row.postId] = Number(row.n)
  const down: Record<string, number> = {}
  for (const row of counts) down[row.postId] = Number(row.n)
  const mine: Record<string, 'up' | 'down'> = {}
  for (const row of ups) mine[row.postId] = 'up'
  for (const row of downs) mine[row.postId] = 'down'
  return { up, down, mine }
}

async function currentVote(postId: PostId, viewer: PrincipalId): Promise<IdeaVote> {
  const votes = await ideaVotes([postId], viewer)
  return votes.mine[postId] ?? null
}

/** The score of one idea right now. */
export async function scoreOf(postId: PostId): Promise<number> {
  const [row] = await db
    .select({ up: posts.voteCount })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1)
  const votes = await ideaVotes([postId])
  return ideaScore(row?.up ?? 0, votes.down[postId] ?? 0)
}

/**
 * The signed-in viewer presses up or down on an idea. Upvotes go through Quackback's vote toggle
 * (which checks portal access and the board's vote tier); a downvote checks the same tier itself.
 */
export async function voteIdea(
  postId: PostId,
  pressed: 'up' | 'down'
): Promise<{ vote: IdeaVote; score: number }> {
  const { getOptionalAuth, policyActorFromAuth } =
    await import('@/lib/server/functions/auth-helpers')
  const { resolvePortalAccessForRequest } = await import('@/lib/server/functions/portal-access')
  const { runToggleVote } = await import('@/lib/server/functions/public-posts')
  const { assertPostVotable } = await import('@/lib/server/domains/posts/post.access')

  const access = await resolvePortalAccessForRequest()
  if (!access.granted) throw new Error('Portal access required')
  // signed-in people only: anonymous voting is off in the hub
  const auth = await getOptionalAuth()
  if (!auth || auth.principal.type === 'anonymous') throw new Error('Authentication required')
  const viewer = auth.principal.id as PrincipalId
  await assertPostVotable(postId, await policyActorFromAuth(auth))

  const current = await currentVote(postId, viewer)
  const { next } = applyVote(current, pressed)

  if (current === 'down') {
    await db
      .delete(crazyPostDownvotes)
      .where(and(eq(crazyPostDownvotes.postId, postId), eq(crazyPostDownvotes.principalId, viewer)))
  }
  // Quackback's toggle adds the upvote when there is none and removes it when there is one
  if ((current === 'up') !== (next === 'up')) await runToggleVote(auth, { postId })
  if (next === 'down') {
    await db
      .insert(crazyPostDownvotes)
      .values({ postId, principalId: viewer })
      .onConflictDoNothing()
  }
  return { vote: next, score: await scoreOf(postId) }
}
