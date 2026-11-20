/**
 * Similar ideas while someone writes a title (#5). Quackback's `findSimilarPostsFn` leans on
 * embeddings (an AI provider) and its full-text half needs every word to match, so without an AI key
 * "Slack notifications" never finds "Slack integration". This search matches any word of the title
 * (prefix match, English stemming) within the project's boards, best match first, then votes, and
 * applies Quackback's view rules for the caller (no team-only or held posts of others).
 */
import {
  and,
  boards,
  crazyProjectBoards,
  crazyProjects,
  db,
  desc,
  eq,
  isNull,
  posts,
  sql,
} from '@/lib/server/db'
import { similarTsQuery } from '@/lib/shared/crazy/similar'

export interface SimilarIdea {
  id: string
  title: string
  voteCount: number
}

export async function similarIdeas(projectSlug: string, title: string): Promise<SimilarIdea[]> {
  const query = similarTsQuery(title)
  if (!query) return []
  const [{ getOptionalAuth, policyActorFromAuth }, { postViewFilter }] = await Promise.all([
    import('@/lib/server/functions/auth-helpers'),
    import('@/lib/server/policy'),
  ])
  const actor = await policyActorFromAuth(await getOptionalAuth())
  const tsquery = sql`to_tsquery('english', ${query})`
  const rank = sql<number>`ts_rank(${posts.searchVector}, ${tsquery})`
  const rows = await db
    .select({ id: posts.id, title: posts.title, voteCount: posts.voteCount })
    .from(posts)
    .innerJoin(boards, eq(boards.id, posts.boardId))
    .innerJoin(crazyProjectBoards, eq(crazyProjectBoards.boardId, posts.boardId))
    .innerJoin(crazyProjects, eq(crazyProjects.id, crazyProjectBoards.projectId))
    .where(
      and(
        eq(crazyProjects.slug, projectSlug),
        isNull(posts.deletedAt),
        isNull(posts.canonicalPostId),
        isNull(boards.deletedAt),
        postViewFilter(actor),
        sql`${posts.searchVector} @@ ${tsquery}`
      )
    )
    .orderBy(desc(rank), desc(posts.voteCount))
    .limit(5)
  return rows.map((row) => ({ id: row.id as string, title: row.title, voteCount: row.voteCount }))
}
