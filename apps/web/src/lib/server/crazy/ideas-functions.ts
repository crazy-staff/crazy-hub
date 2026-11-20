/**
 * Server functions of the ideas board that Quackback's portal functions don't cover (#5): per-project
 * moderation and tags (see `ideas.service.ts`), and turning the composer's markdown into the rich
 * text Quackback stores.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

const postId = z.string().min(1).max(64)
const commentId = z.string().min(1).max(64)

/** What the caller may moderate on one idea; all false for visitors and plain members. */
export const getIdeaPermissionsFn = createServerFn({ method: 'GET' })
  .validator(z.object({ postId }))
  .handler(async ({ data }) => {
    const { ideaPermissions } = await import('./ideas.service')
    return ideaPermissions(data.postId)
  })

/**
 * Public role badges of the people on an idea's page (its author and commenters), global roles and
 * those of the idea's project. Public information: anyone who can see the names sees the badges.
 */
export const getRoleBadgesFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, principalIds: z.array(z.string().min(1).max(64)).max(200) }))
  .handler(async ({ data }) => {
    const [{ roleBadges }, { projectOfPost }] = await Promise.all([
      import('./badges.service'),
      import('./ideas.service'),
    ])
    return roleBadges(await projectOfPost(data.postId), data.principalIds)
  })

/** Ideas of a project like the title being written (the composer's "maybe yours is already here"). */
export const findSimilarIdeasFn = createServerFn({ method: 'GET' })
  .validator(z.object({ project: z.string().min(1).max(64), title: z.string().min(3).max(200) }))
  .handler(async ({ data }) => {
    const { resolvePortalAccessForRequest } = await import('@/lib/server/functions/portal-access')
    if (!(await resolvePortalAccessForRequest()).granted) return []
    const { similarIdeas } = await import('./similar.service')
    return similarIdeas(data.project, data.title)
  })

/** Merges a duplicate idea into the canonical one (#37). */
export const mergeIdeaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, canonicalId: postId }))
  .handler(async ({ data }) => {
    const { mergeIdea } = await import('./merge.service')
    await mergeIdea(data.postId, data.canonicalId)
  })

/** Restores a merged idea (#37). */
export const unmergeIdeaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId }))
  .handler(async ({ data }) => {
    const { unmergeIdea } = await import('./merge.service')
    await unmergeIdea(data.postId)
  })

/** The ideas merged into this one (#37). */
export const getMergedIdeasFn = createServerFn({ method: 'GET' })
  .validator(z.object({ postId }))
  .handler(async ({ data }) => {
    const { resolvePortalAccessForRequest } = await import('@/lib/server/functions/portal-access')
    if (!(await resolvePortalAccessForRequest()).granted) return []
    const { mergedIdeas } = await import('./merge.service')
    return mergedIdeas(data.postId)
  })

/** Ideas to merge with, oldest first (#37; moderators with `ideas.merge`). */
export const getMergeCandidatesFn = createServerFn({ method: 'GET' })
  .validator(z.object({ postId, query: z.string().max(200), direction: z.enum(['into', 'here']) }))
  .handler(async ({ data }) => {
    const { mergeCandidates } = await import('./merge.service')
    return mergeCandidates(data.postId, data.query, data.direction)
  })

export const setIdeaStatusFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, statusId: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    const { setIdeaStatus } = await import('./ideas.service')
    await setIdeaStatus(data.postId, data.statusId)
  })

export const moveIdeaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, boardId: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    const { moveIdea } = await import('./ideas.service')
    await moveIdea(data.postId, data.boardId)
  })

export const editIdeaFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      postId,
      title: z.string().trim().min(1).max(200),
      content: z.string().max(20000),
      contentJson: z.unknown().optional(),
    })
  )
  .handler(async ({ data }) => {
    const { editIdea } = await import('./ideas.service')
    await editIdea(data.postId, data)
  })

export const setIdeaTagsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, tagIds: z.array(z.string().min(1).max(64)).max(20) }))
  .handler(async ({ data }) => {
    const { setIdeaTags } = await import('./ideas.service')
    await setIdeaTags(data.postId, [...new Set(data.tagIds)])
  })

export const deleteIdeaFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId }))
  .handler(async ({ data }) => {
    const { deleteIdea } = await import('./ideas.service')
    await deleteIdea(data.postId)
  })

export const removeCommentFn = createServerFn({ method: 'POST' })
  .validator(z.object({ commentId }))
  .handler(async ({ data }) => {
    const { removeComment } = await import('./ideas.service')
    await removeComment(data.commentId)
  })

export const restoreCommentFn = createServerFn({ method: 'POST' })
  .validator(z.object({ commentId }))
  .handler(async ({ data }) => {
    const { restoreComment } = await import('./ideas.service')
    await restoreComment(data.commentId)
  })

export const pinCommentFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, commentId: commentId.nullable() }))
  .handler(async ({ data }) => {
    const { pinComment } = await import('./ideas.service')
    await pinComment(data.postId, data.commentId)
  })

export const lockCommentsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ postId, locked: z.boolean() }))
  .handler(async ({ data }) => {
    const { lockComments } = await import('./ideas.service')
    await lockComments(data.postId, data.locked)
  })

/**
 * The composer writes markdown; Quackback stores TipTap JSON beside the plain text. Converted and
 * sanitized here, then passed to Quackback's own create/edit functions.
 */
export const markdownToContentFn = createServerFn({ method: 'POST' })
  .validator(z.object({ markdown: z.string().max(10000) }))
  .handler(async ({ data }) => {
    const [{ markdownToTiptapJson }, { sanitizeTiptapContent }, { linksToMentions }] =
      await Promise.all([
        import('@/lib/server/markdown-tiptap'),
        import('@/lib/server/sanitize-tiptap'),
        import('@/lib/shared/crazy/mentions'),
      ])
    // `[@Name](/u/principal_…)` links become mention nodes (notifications, live names)
    const parsed = markdownToTiptapJson(data.markdown)
    return sanitizeTiptapContent(linksToMentions(parsed) as typeof parsed)
  })

/** Tells the people mentioned in the caller's own comment, once per comment (after posting or editing). */
export const notifyCommentMentionsFn = createServerFn({ method: 'POST' })
  .validator(z.object({ commentId }))
  .handler(async ({ data }) => {
    const { notifyCommentMentions } = await import('./mentions.service')
    return notifyCommentMentions(data.commentId)
  })
