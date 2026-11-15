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
    const [{ markdownToTiptapJson }, { sanitizeTiptapContent }] = await Promise.all([
      import('@/lib/server/markdown-tiptap'),
      import('@/lib/server/sanitize-tiptap'),
    ])
    return sanitizeTiptapContent(markdownToTiptapJson(data.markdown))
  })
