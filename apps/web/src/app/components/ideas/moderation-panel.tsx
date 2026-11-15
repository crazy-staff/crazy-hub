/**
 * Moderation of one idea in the page's right column (owner's note, #45): the idea's facts, status,
 * board, tags, comments lock, the official response and deleting it. What shows depends on the
 * caller's permissions in the idea's project (decision 13): `ideas.status` (status and board),
 * `ideas.tags`, `comments.moderate` (lock, official response), `ideas.delete`.
 */
import { AlertDialog, Button, Chip, Select, Switch } from '@crazy-staff/ui'
import { ArrowDown, ArrowUp, MessageSquare, PinOff, Trash2 } from 'lucide-react'
import type { PublicPostDetailView } from '@/lib/client/queries/portal-detail'
import {
  lockCommentsFn,
  moveIdeaFn,
  pinCommentFn,
  setIdeaStatusFn,
} from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { formatDate, useAct } from '../../lib/idea-act'
import type { HubProject } from '../../lib/projects'
import { AuthorLink } from '../author-link'
import { SidePanelSection } from '../side-panel'
import { TagsDialog } from './tags-dialog'
import { countComments } from './comments'

export interface IdeaPermissions {
  status: boolean
  tags: boolean
  delete: boolean
  comments: boolean
}

export function ModerationPanelContent({
  post,
  project,
  can,
  statuses,
  votes,
  onDelete,
}: {
  post: PublicPostDetailView
  project: HubProject
  can: IdeaPermissions
  statuses: { id: string; name: string; color: string | null }[]
  votes: { up: number; down: number }
  onDelete: () => void
}) {
  const postId = post.id as string
  const act = useAct(postId)
  return (
    <>
      <SidePanelSection label={m.ideas_facts()}>
        <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
          <dt className="text-muted">{m.ideas_votes()}</dt>
          <dd className="flex items-center gap-3 tabular-nums">
            <span className="inline-flex items-center gap-1">
              <ArrowUp className="size-3.5 text-accent" /> {votes.up}
            </span>
            <span className="inline-flex items-center gap-1">
              <ArrowDown className="size-3.5 text-danger" /> {votes.down}
            </span>
          </dd>
          <dt className="text-muted">{m.ideas_comments()}</dt>
          <dd className="inline-flex items-center gap-1 tabular-nums">
            <MessageSquare className="size-3.5 text-muted" /> {countComments(post.comments)}
          </dd>
          <dt className="text-muted">{m.ideas_author()}</dt>
          <dd className="truncate">
            <AuthorLink principalId={post.principalId}>{post.authorName ?? '—'}</AuthorLink>
          </dd>
          <dt className="text-muted">{m.ideas_created()}</dt>
          <dd>{formatDate(post.createdAt)}</dd>
        </dl>
      </SidePanelSection>

      {can.status && (
        <SidePanelSection label={m.ideas_status()}>
          <Select
            size="sm"
            aria-label={m.ideas_status()}
            value={post.statusId}
            onValueChange={(next) =>
              next &&
              void act(
                () => setIdeaStatusFn({ data: { postId, statusId: next } }),
                m.settings_saved()
              )
            }
            items={statuses.map((s) => ({ value: s.id, label: s.name }))}
          />
        </SidePanelSection>
      )}

      {can.status && project.boards.length > 1 && (
        <SidePanelSection label={m.ideas_board()}>
          <Select
            size="sm"
            aria-label={m.ideas_board()}
            value={post.board.id}
            onValueChange={(next) =>
              next &&
              next !== post.board.id &&
              void act(() => moveIdeaFn({ data: { postId, boardId: next } }), m.ideas_moved())
            }
            items={project.boards.map((b) => ({ value: b.id, label: b.name }))}
          />
        </SidePanelSection>
      )}

      {can.tags && (
        <SidePanelSection label={m.ideas_tags()}>
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Chip key={tag.id} size="sm" variant="neutral">
                  {tag.name}
                </Chip>
              ))}
            </div>
          )}
          <TagsDialog
            postId={postId}
            current={post.tags.map((t) => t.id)}
            moderator
            className="w-full"
          />
        </SidePanelSection>
      )}

      {can.comments && (
        <SidePanelSection label={m.ideas_comments()}>
          <Switch
            size="sm"
            label={m.ideas_lock_comments()}
            checked={!!post.isCommentsLocked}
            onCheckedChange={(locked) =>
              void act(() => lockCommentsFn({ data: { postId, locked } }))
            }
          />
          {post.pinnedComment && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => act(() => pinCommentFn({ data: { postId, commentId: null } }))}
            >
              <PinOff /> {m.ideas_unpin()}
            </Button>
          )}
        </SidePanelSection>
      )}

      {can.delete && (
        <div className="border-t border-border pt-4">
          <AlertDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-danger hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 /> {m.ideas_delete()}
              </Button>
            }
            title={m.ideas_delete_confirm()}
            cancelLabel={m.admin_cancel()}
            actionLabel={m.admin_delete()}
            tone="danger"
            onAction={onDelete}
          />
        </div>
      )}
    </>
  )
}
