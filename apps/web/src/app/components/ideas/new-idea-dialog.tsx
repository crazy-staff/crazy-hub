/**
 * Post an idea (#5): board (when the project has several), title with similar ideas while typing, the
 * description with formatting and images, and tags (category, game … from the public tags). On
 * success the new idea opens.
 */
import { Field, Input, Select } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { useSimilarPosts } from '@/lib/client/hooks/use-similar-posts'
import { markdownToContentFn, setIdeaTagsFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { FormDialog } from '../form-dialog'
import type { HubProject } from '../../lib/projects'
import { useCreateIdea } from '../../lib/idea-mutations'
import { MarkdownEditor } from './markdown-editor'
import { TagPicker } from './tag-picker'

export function NewIdeaDialog({
  project,
  boardId,
  onClose,
}: {
  project: HubProject
  /** The board picked in the list, if any. */
  boardId?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateIdea()
  const tags = useQuery(portalQueries.tags()).data ?? []
  const [board, setBoard] = useState<string | null>(boardId ?? project.boards[0]?.id ?? null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tagIds, setTagIds] = useState<string[]>([])
  const similar = useSimilarPosts({ title })
  const boardSlugs = new Set(project.boards.map((b) => b.slug))
  const matches = (similar.posts ?? []).filter((p) => boardSlugs.has(p.boardSlug))

  return (
    <FormDialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={m.ideas_new()}
      submitLabel={m.ideas_post()}
      onSubmit={async () => {
        if (!board || !title.trim()) throw new Error('missing')
        const markdown = body.trim()
        const contentJson = markdown ? await markdownToContentFn({ data: { markdown } }) : undefined
        const created = await create.mutateAsync({
          boardId: board,
          title: title.trim(),
          content: markdown,
          contentJson,
        })
        if (tagIds.length) {
          await setIdeaTagsFn({ data: { postId: created.id, tagIds } }).catch(() => {})
        }
        void navigate({
          to: '/$project/ideas/$postId',
          params: { project: project.slug, postId: created.id },
        })
      }}
    >
      {project.boards.length > 1 && (
        <Field label={m.ideas_board()} required>
          <Select
            aria-label={m.ideas_board()}
            value={board}
            onValueChange={setBoard}
            items={project.boards.map((b) => ({ value: b.id, label: b.name }))}
          />
        </Field>
      )}
      <Field label={m.ideas_title()} required>
        <Input
          name="title"
          required
          maxLength={200}
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Field>
      {matches.length > 0 && (
        <div className="-mt-2 flex flex-col gap-1 rounded-control border border-border p-3 text-sm">
          <span className="text-xs font-medium text-muted">{m.ideas_similar()}</span>
          {matches.map((post) => (
            <Link
              key={post.id}
              to="/$project/ideas/$postId"
              params={{ project: project.slug, postId: post.id }}
              className="flex items-center gap-2 rounded-control-sm px-1 py-0.5 hover:bg-hover"
            >
              <span className="w-8 shrink-0 text-end text-xs tabular-nums text-muted">
                ▲ {post.voteCount}
              </span>
              <span className="truncate">{post.title}</span>
            </Link>
          ))}
        </div>
      )}
      <MarkdownEditor
        label={m.ideas_description()}
        placeholder={m.ideas_description_placeholder()}
        value={body}
        onChange={setBody}
      />
      {tags.length > 0 && (
        <Field label={m.ideas_tags()}>
          <TagPicker tags={tags} value={tagIds} onChange={setTagIds} />
        </Field>
      )}
    </FormDialog>
  )
}
