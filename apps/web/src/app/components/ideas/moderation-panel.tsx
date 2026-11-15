/**
 * Moderation of one idea in the page's right column (owner's note, #45): the idea at a glance (votes
 * up and down, comments, author), then status, board, tags, comments and, apart, deleting it. What
 * shows depends on the caller's permissions in the idea's project (decision 13): `ideas.status`
 * (status and board), `ideas.tags`, `comments.moderate` (lock, official response), `ideas.delete`.
 */
import { AlertDialog, Avatar, Button, Chip, Select, Switch, cn } from '@crazy-staff/ui'
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  LayoutList,
  MessageSquare,
  MessagesSquare,
  PinOff,
  Tags,
  Trash2,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react'
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

/** One number of the idea at a glance. */
function Stat({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon
  value: number
  label: string
  tone?: 'accent' | 'danger'
}) {
  return (
    <div className="squircle flex flex-col items-center gap-1 rounded-control bg-surface-2 px-2 py-3">
      <span
        className={cn(
          'flex items-center gap-1 text-lg leading-none font-semibold tabular-nums',
          tone === 'accent' && 'text-accent',
          tone === 'danger' && 'text-danger'
        )}
      >
        <Icon className="size-4" strokeWidth={2.5} />
        {value}
      </span>
      <span className="text-[0.6875rem] text-muted">{label}</span>
    </div>
  )
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
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={ArrowUp} value={votes.up} label={m.ideas_votes_up()} tone="accent" />
          <Stat icon={ArrowDown} value={votes.down} label={m.ideas_votes_down()} tone="danger" />
          <Stat
            icon={MessageSquare}
            value={countComments(post.comments)}
            label={m.ideas_comments()}
          />
        </div>
        <div className="flex items-center gap-3">
          <Avatar size="sm" src={post.authorAvatarUrl ?? undefined} name={post.authorName ?? '?'} />
          <div className="flex min-w-0 flex-col">
            <AuthorLink principalId={post.principalId} className="truncate text-sm font-medium">
              {post.authorName ?? '—'}
            </AuthorLink>
            <span className="text-xs text-muted">
              {m.ideas_created()} {formatDate(post.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {can.status && (
        <SidePanelSection label={m.ideas_status()} icon={CircleDot}>
          <Select
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
        <SidePanelSection
          label={m.ideas_board()}
          icon={LayoutList}
          description={m.ideas_board_move_hint()}
        >
          <Select
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
        <SidePanelSection label={m.ideas_tags()} icon={Tags}>
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Chip key={tag.id} variant="neutral">
                  {tag.name}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted">{m.ideas_no_tags()}</span>
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
        <SidePanelSection label={m.ideas_comments()} icon={MessagesSquare}>
          <Switch
            label={m.ideas_lock_comments()}
            description={m.ideas_lock_comments_hint()}
            checked={!!post.isCommentsLocked}
            onCheckedChange={(locked) =>
              void act(() => lockCommentsFn({ data: { postId, locked } }))
            }
          />
          {post.pinnedComment && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => act(() => pinCommentFn({ data: { postId, commentId: null } }))}
            >
              <PinOff /> {m.ideas_unpin()}
            </Button>
          )}
        </SidePanelSection>
      )}

      {can.delete && (
        <SidePanelSection
          label={m.ideas_danger_zone()}
          icon={TriangleAlert}
          className="[&>div>span:first-child]:text-danger"
        >
          <AlertDialog
            trigger={
              <Button
                variant="outline"
                className="w-full border-danger/40 text-danger hover:bg-danger/10 hover:text-danger"
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
        </SidePanelSection>
      )}
    </>
  )
}
