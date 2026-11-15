/**
 * Moderation of a project's ideas by crazy-hub roles (#5, decision 13). Quackback's own server
 * functions need its team role, which moderators never get; these check the caller's permission in
 * the project the idea belongs to (through its board) and then call Quackback's domain services.
 */
import type { PostCommentId, PostId, PostStatusId, PostTagId, UserId } from '@quackback/ids'
import {
  and,
  crazyProjectBoards,
  db,
  eq,
  inArray,
  isNull,
  postComments,
  postTags,
  posts,
} from '@/lib/server/db'
import type { CrazyPermission } from '@/lib/shared/crazy/permissions'
import { PERMISSIONS } from '@/lib/shared/permissions'
import { getOptionalHubAccess } from './roles.service'

/** The project an idea belongs to (through its board), or null. */
export async function projectOfPost(postId: string): Promise<string | null> {
  const [row] = await db
    .select({ projectId: crazyProjectBoards.projectId })
    .from(posts)
    .innerJoin(crazyProjectBoards, eq(crazyProjectBoards.boardId, posts.boardId))
    .where(eq(posts.id, postId as PostId))
    .limit(1)
  return row?.projectId ?? null
}

/** The signed-in caller, allowed `permission` in the idea's project; throws otherwise. */
export async function requireIdeaPermission(postId: string, permission: CrazyPermission) {
  const access = await getOptionalHubAccess()
  if (!access) throw new Error('Authentication required')
  const projectId = await projectOfPost(postId)
  if (!projectId || !access.permissionsIn(projectId).has(permission)) {
    throw new Error(`Access denied: Requires crazy-hub permission '${permission}'`)
  }
  return { ...access, projectId }
}

async function postOfComment(commentId: string): Promise<string | null> {
  const [row] = await db
    .select({ postId: postComments.postId })
    .from(postComments)
    .where(eq(postComments.id, commentId as PostCommentId))
    .limit(1)
  return (row?.postId as string | undefined) ?? null
}

export async function requireCommentPermission(commentId: string, permission: CrazyPermission) {
  const postId = await postOfComment(commentId)
  if (!postId) throw new Error('Not found')
  return { ...(await requireIdeaPermission(postId, permission)), postId }
}

/** What the caller may do on one idea (for the moderation buttons). */
export async function ideaPermissions(postId: string) {
  const access = await getOptionalHubAccess()
  const projectId = access ? await projectOfPost(postId) : null
  const granted = access && projectId ? access.permissionsIn(projectId) : new Set<CrazyPermission>()
  return {
    status: granted.has('ideas.status'),
    tags: granted.has('ideas.tags'),
    delete: granted.has('ideas.delete'),
    comments: granted.has('comments.moderate'),
  }
}

export async function setIdeaStatus(postId: string, statusId: string) {
  const access = await requireIdeaPermission(postId, 'ideas.status')
  const { changeStatus } = await import('@/lib/server/domains/posts/post.status')
  await changeStatus(postId as PostId, statusId as PostStatusId, {
    principalId: access.principalId,
    userId: access.userId,
  })
}

/** Only these tags may be chosen by authors (Quackback's public tags). */
async function publicTagIds(tagIds: string[]): Promise<string[]> {
  if (tagIds.length === 0) return []
  const rows = await db
    .select({ id: postTags.id })
    .from(postTags)
    .where(
      and(
        inArray(postTags.id, tagIds as PostTagId[]),
        eq(postTags.isPublic, true),
        isNull(postTags.deletedAt)
      )
    )
  return rows.map((r) => r.id as string)
}

/**
 * Replaces an idea's tags. Moderators (`ideas.tags`) may use any tag; the author of the idea may
 * choose among the public tags.
 */
export async function setIdeaTags(postId: string, tagIds: string[]) {
  const access = await getOptionalHubAccess()
  if (!access) throw new Error('Authentication required')
  const projectId = await projectOfPost(postId)
  if (!projectId) throw new Error('Not found')
  const moderator = access.permissionsIn(projectId).has('ideas.tags')
  let allowed = tagIds
  if (!moderator) {
    const [post] = await db
      .select({ principalId: posts.principalId })
      .from(posts)
      .where(eq(posts.id, postId as PostId))
      .limit(1)
    if (post?.principalId !== access.principalId) {
      throw new Error("Access denied: Requires crazy-hub permission 'ideas.tags'")
    }
    allowed = await publicTagIds(tagIds)
  }
  const { updatePost } = await import('@/lib/server/domains/posts/post.service')
  await updatePost(
    postId as PostId,
    { tagIds: allowed as PostTagId[] },
    {
      principalId: access.principalId,
      userId: access.userId,
    }
  )
}

/**
 * Deletes an idea: anyone with `ideas.delete` in its project, or its author while nobody else has
 * engaged with it (no comments, no votes besides the author's own: Quackback counts that one, so its
 * own author-delete rule never lets an author delete). Throws `idea-has-engagement` otherwise.
 */
export async function deleteIdea(postId: string) {
  const access = await getOptionalHubAccess()
  if (!access) throw new Error('Authentication required')
  const projectId = await projectOfPost(postId)
  if (!projectId) throw new Error('Not found')
  if (!access.permissionsIn(projectId).has('ideas.delete')) {
    const [post] = await db
      .select({
        principalId: posts.principalId,
        voteCount: posts.voteCount,
        commentCount: posts.commentCount,
      })
      .from(posts)
      .where(eq(posts.id, postId as PostId))
      .limit(1)
    if (!post || post.principalId !== access.principalId) {
      throw new Error("Access denied: Requires crazy-hub permission 'ideas.delete'")
    }
    if (post.commentCount > 0 || post.voteCount > 1) throw new Error('idea-has-engagement')
  }
  const { softDeletePost } = await import('@/lib/server/domains/posts/post.user-actions')
  // a team role skips Quackback's author-only rules; the checks above decide
  await softDeletePost(postId as PostId, {
    principalId: access.principalId,
    role: 'member',
    userId: access.userId as UserId,
  })
}

export async function removeComment(commentId: string) {
  const access = await requireCommentPermission(commentId, 'comments.moderate')
  const { softDeleteComment } = await import('@/lib/server/domains/comments/comment.permissions')
  await softDeleteComment(commentId as PostCommentId, {
    principalId: access.principalId,
    role: 'user',
    permissions: [PERMISSIONS.COMMENT_EDIT],
  })
}

export async function restoreComment(commentId: string) {
  const access = await requireCommentPermission(commentId, 'comments.moderate')
  const domain = await import('@/lib/server/domains/comments/comment.pin')
  await domain.restoreComment(commentId as PostCommentId, {
    principalId: access.principalId,
    role: 'member',
  })
}

/**
 * Pins a root comment as the official response (null unpins). Quackback only pins comments its team
 * wrote; here the moderator decides.
 */
export async function pinComment(postId: string, commentId: string | null) {
  await requireIdeaPermission(postId, 'comments.moderate')
  if (commentId) {
    const [comment] = await db
      .select({ postId: postComments.postId, parentId: postComments.parentId })
      .from(postComments)
      .where(and(eq(postComments.id, commentId as PostCommentId), isNull(postComments.deletedAt)))
      .limit(1)
    if (!comment || comment.postId !== postId || comment.parentId) {
      throw new Error('cannot-pin')
    }
  }
  await db
    .update(posts)
    .set({ pinnedCommentId: commentId as PostCommentId | null })
    .where(eq(posts.id, postId as PostId))
}

export async function lockComments(postId: string, locked: boolean) {
  await requireIdeaPermission(postId, 'comments.moderate')
  await db
    .update(posts)
    .set({ isCommentsLocked: locked })
    .where(eq(posts.id, postId as PostId))
}
