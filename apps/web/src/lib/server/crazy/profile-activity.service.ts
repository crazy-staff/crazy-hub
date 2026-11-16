/**
 * Recent activity on a public profile (`/u/$principalId`): the ideas a person posted and every
 * public comment and reply they wrote, newest first, with a short excerpt and the project the idea
 * belongs to, so anyone can read what they wrote before. Filtered through the VIEWER's board
 * visibility (`postViewFilter`) like Quackback's own profile query; private team notes, pending and
 * removed comments never show. `commentCount` counts every comment and reply (Quackback's profile
 * counts the ideas commented on).
 */
import type { PrincipalId } from '@quackback/ids'
import {
  and,
  boards,
  crazyProjectBoards,
  crazyProjects,
  db,
  desc,
  eq,
  inArray,
  isNull,
  lt,
  postComments,
  posts,
  sql,
} from '@/lib/server/db'
import { postViewFilter, type Actor } from '@/lib/server/policy'
import { notTestPrincipal } from '@/lib/server/test-data'
import { plainText } from '@/lib/shared/crazy/plain-text'

export const ACTIVITY_PAGE = 20
const EXCERPT = 280

export interface ProfileActivityItem {
  kind: 'idea' | 'comment' | 'reply'
  /** The idea's id, plus the comment's for comments and replies. */
  postId: string
  commentId: string | null
  postTitle: string
  /** URL segment of the idea's project, null for a board outside every project. */
  projectSlug: string | null
  projectName: string | null
  excerpt: string
  createdAt: string
}

export interface ProfileActivity {
  commentCount: number
  items: ProfileActivityItem[]
  /** Pass as `before` for the next page; null on the last one. */
  next: string | null
}

const excerpt = (text: string) => {
  const flat = plainText(text).replace(/\s+/g, ' ').trim()
  return flat.length > EXCERPT ? `${flat.slice(0, EXCERPT - 1).trimEnd()}…` : flat
}

export async function profileActivity(
  principalId: PrincipalId,
  actor: Actor,
  before?: string
): Promise<ProfileActivity> {
  const viewer = and(
    postViewFilter(actor),
    notTestPrincipal(posts.principalId),
    isNull(posts.deletedAt)
  )
  const visibleComment = and(
    eq(postComments.principalId, principalId),
    eq(postComments.isPrivate, false),
    // a comment waiting for approval shows to its author only, as on the idea page
    actor.principalId === principalId
      ? inArray(postComments.moderationState, ['published', 'pending'])
      : eq(postComments.moderationState, 'published'),
    isNull(postComments.deletedAt),
    viewer
  )
  const cursor = before ? new Date(before) : null
  const project = { projectSlug: crazyProjects.slug, projectName: crazyProjects.name }

  const [ideas, comments, [count]] = await Promise.all([
    db
      .select({
        postId: posts.id,
        postTitle: posts.title,
        content: posts.content,
        createdAt: posts.createdAt,
        ...project,
      })
      .from(posts)
      .innerJoin(boards, eq(posts.boardId, boards.id))
      .leftJoin(crazyProjectBoards, eq(crazyProjectBoards.boardId, boards.id))
      .leftJoin(crazyProjects, eq(crazyProjects.id, crazyProjectBoards.projectId))
      .where(
        and(
          eq(posts.principalId, principalId),
          viewer,
          cursor ? lt(posts.createdAt, cursor) : undefined
        )
      )
      .orderBy(desc(posts.createdAt))
      .limit(ACTIVITY_PAGE + 1),
    db
      .select({
        postId: posts.id,
        commentId: postComments.id,
        parentId: postComments.parentId,
        postTitle: posts.title,
        content: postComments.content,
        createdAt: postComments.createdAt,
        ...project,
      })
      .from(postComments)
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .innerJoin(boards, eq(posts.boardId, boards.id))
      .leftJoin(crazyProjectBoards, eq(crazyProjectBoards.boardId, boards.id))
      .leftJoin(crazyProjects, eq(crazyProjects.id, crazyProjectBoards.projectId))
      .where(and(visibleComment, cursor ? lt(postComments.createdAt, cursor) : undefined))
      .orderBy(desc(postComments.createdAt))
      .limit(ACTIVITY_PAGE + 1),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(postComments)
      .innerJoin(posts, eq(posts.id, postComments.postId))
      .innerJoin(boards, eq(posts.boardId, boards.id))
      .where(visibleComment),
  ])

  const merged: ProfileActivityItem[] = [
    ...ideas.map((row) => ({
      kind: 'idea' as const,
      postId: row.postId,
      commentId: null,
      postTitle: row.postTitle,
      projectSlug: row.projectSlug,
      projectName: row.projectName,
      excerpt: excerpt(row.content),
      createdAt: row.createdAt.toISOString(),
    })),
    ...comments.map((row) => ({
      kind: row.parentId ? ('reply' as const) : ('comment' as const),
      postId: row.postId,
      commentId: row.commentId,
      postTitle: row.postTitle,
      projectSlug: row.projectSlug,
      projectName: row.projectName,
      excerpt: excerpt(row.content),
      createdAt: row.createdAt.toISOString(),
    })),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  const items = merged.slice(0, ACTIVITY_PAGE)
  return {
    commentCount: Number(count?.n ?? 0),
    items,
    next: merged.length > ACTIVITY_PAGE ? items[items.length - 1].createdAt : null,
  }
}
