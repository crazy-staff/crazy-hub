/**
 * Mention notifications for comments (#5). Quackback notifies people mentioned in a post
 * (`syncPostMentions`) but has no dispatch for comments, although its notification catalog lists
 * `comment_mentioned`. After a comment is posted or edited, its author's client calls this: the
 * comment is read from the database (never trusted from the client), and everyone mentioned in it
 * who hasn't been told about this comment yet gets an in-app notification. Held comments wait.
 */
import type { PostCommentId, PostId, PrincipalId } from '@quackback/ids'
import {
  and,
  db,
  eq,
  inAppNotifications,
  inArray,
  postComments,
  posts,
  principal,
} from '@/lib/server/db'
import { extractMentionExcerpts } from '@/lib/server/domains/posts/extract-mentions'
import { createNotificationsBatch } from '@/lib/server/domains/notifications/notification.service'
import { getOptionalAuth } from '@/lib/server/functions/auth-helpers'

const ELIGIBLE_ROLES = ['admin', 'member', 'user']

/** Notifies the people newly mentioned in the caller's own comment; returns how many were told. */
export async function notifyCommentMentions(commentId: string): Promise<number> {
  const auth = await getOptionalAuth()
  if (!auth) throw new Error('Authentication required')

  const [comment] = await db
    .select({
      id: postComments.id,
      postId: postComments.postId,
      principalId: postComments.principalId,
      contentJson: postComments.contentJson,
      moderationState: postComments.moderationState,
      deletedAt: postComments.deletedAt,
      isPrivate: postComments.isPrivate,
      postTitle: posts.title,
    })
    .from(postComments)
    .innerJoin(posts, eq(posts.id, postComments.postId))
    .where(eq(postComments.id, commentId as PostCommentId))
    .limit(1)
  if (!comment || comment.principalId !== auth.principal.id) {
    throw new Error('Access denied: not your comment')
  }
  if (comment.deletedAt || comment.isPrivate || comment.moderationState !== 'published') return 0

  const excerpts = extractMentionExcerpts(comment.contentJson as never)
  excerpts.delete(auth.principal.id as PrincipalId)
  if (excerpts.size === 0) return 0

  const ids = [...excerpts.keys()]
  const [eligible, told] = await Promise.all([
    db
      .select({ id: principal.id })
      .from(principal)
      .where(
        and(
          inArray(principal.id, ids),
          eq(principal.type, 'user'),
          inArray(principal.role, ELIGIBLE_ROLES)
        )
      ),
    db
      .select({ principalId: inAppNotifications.principalId })
      .from(inAppNotifications)
      .where(
        and(
          eq(inAppNotifications.commentId, comment.id),
          eq(inAppNotifications.type, 'comment_mentioned'),
          inArray(inAppNotifications.principalId, ids)
        )
      ),
  ])
  const already = new Set(told.map((row) => row.principalId as string))
  const actorName = auth.user.name?.trim() || 'Someone'
  const inputs = eligible
    .filter((row) => !already.has(row.id))
    .map((row) => ({
      principalId: row.id as PrincipalId,
      type: 'comment_mentioned' as const,
      title: `${actorName} mentioned you in a comment`,
      body: comment.postTitle.slice(0, 150),
      postId: comment.postId as PostId,
      commentId: comment.id as PostCommentId,
      metadata: { excerpt: excerpts.get(row.id as PrincipalId), actorName },
    }))
  await createNotificationsBatch(inputs)
  return inputs.length
}
