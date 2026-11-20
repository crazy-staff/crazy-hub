/**
 * Merging duplicate ideas (#37), like closing a GitHub issue as a duplicate: the duplicate points to
 * the canonical idea (Quackback's `canonical_post_id`), its votes count there, the list hides it and
 * its page says where it went. Both ideas must be in the same project, and the caller needs
 * `ideas.merge` there. Quackback's `mergePost` / `unmergePost` do the work (vote recount, events).
 */
import type { PostId } from '@quackback/ids'
import {
  and,
  asc,
  crazyProjectBoards,
  db,
  eq,
  ilike,
  isNull,
  ne,
  or,
  posts,
  sql,
} from '@/lib/server/db'
import { similarTsQuery } from '@/lib/shared/crazy/similar'
import { projectOfPost, requireIdeaPermission } from './ideas.service'

/** Merges `duplicateId` into `canonicalId`; the caller needs `ideas.merge` in their project. */
export async function mergeIdea(duplicateId: string, canonicalId: string) {
  const access = await requireIdeaPermission(duplicateId, 'ideas.merge')
  if ((await projectOfPost(canonicalId)) !== access.projectId) {
    throw new Error('Access denied: the ideas are in different projects')
  }
  const { mergePost } = await import('@/lib/server/domains/posts/post.merge')
  await mergePost(duplicateId as PostId, canonicalId as PostId, access.principalId, access.userId)
}

/** Restores a merged idea as an idea of its own. */
export async function unmergeIdea(postId: string) {
  const access = await requireIdeaPermission(postId, 'ideas.merge')
  const { unmergePost } = await import('@/lib/server/domains/posts/post.merge')
  await unmergePost(postId as PostId, access.principalId, access.userId)
}

/** The ideas merged into this one, in merge order (public: the duplicates' pages are public too). */
export async function mergedIdeas(postId: string) {
  const { getMergedPosts } = await import('@/lib/server/domains/posts/post.merge')
  const rows = await getMergedPosts(postId as PostId)
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title,
    authorName: row.authorName,
    voteCount: row.voteCount,
    mergedAt: row.mergedAt.toISOString(),
  }))
}

export interface MergeCandidate {
  id: string
  title: string
  voteCount: number
  createdAt: string
}

/**
 * Ideas of the same project the idea could be merged with (`into`: targets for "Merge into…";
 * `here`: duplicates for "Merge others here"), oldest first, as the first idea is the canonical one by
 * default. Without a query the idea's own title finds the likely duplicates; with one, any title
 * containing it. Ideas already merged, and (for targets) ideas that have duplicates of their own
 * when merging a canonical idea, are left out.
 */
export async function mergeCandidates(
  postId: string,
  query: string,
  direction: 'into' | 'here'
): Promise<MergeCandidate[]> {
  const access = await requireIdeaPermission(postId, 'ideas.merge')
  const [self] = await db
    .select({ title: posts.title })
    .from(posts)
    .where(eq(posts.id, postId as PostId))
    .limit(1)
  if (!self) return []
  const text = query.trim()
  const words = similarTsQuery(text || self.title)
  const match = text
    ? or(
        ilike(posts.title, `%${text.replace(/[\\%_]/g, '\\$&')}%`),
        words ? sql`${posts.searchVector} @@ to_tsquery('english', ${words})` : undefined
      )
    : words
      ? sql`${posts.searchVector} @@ to_tsquery('english', ${words})`
      : undefined
  const rows = await db
    .select({
      id: posts.id,
      title: posts.title,
      voteCount: posts.voteCount,
      createdAt: posts.createdAt,
    })
    .from(posts)
    .innerJoin(crazyProjectBoards, eq(crazyProjectBoards.boardId, posts.boardId))
    .where(
      and(
        eq(crazyProjectBoards.projectId, access.projectId),
        ne(posts.id, postId as PostId),
        isNull(posts.deletedAt),
        isNull(posts.canonicalPostId),
        eq(posts.moderationState, 'published'),
        // a duplicate must not have duplicates of its own (Quackback refuses the merge)
        direction === 'here'
          ? sql`NOT EXISTS (SELECT 1 FROM posts c WHERE c.canonical_post_id = ${posts.id} AND c.deleted_at IS NULL)`
          : undefined,
        match
      )
    )
    .orderBy(asc(posts.createdAt))
    .limit(8)
  return rows.map((row) => ({
    id: row.id as string,
    title: row.title,
    voteCount: row.voteCount,
    createdAt: row.createdAt.toISOString(),
  }))
}
