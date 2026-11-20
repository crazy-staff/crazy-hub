/**
 * Moderation of one idea in the page's right column (owner's note, #45), next to the page's own edit
 * and delete buttons: the idea at a glance (votes for / against, comments, author), then status,
 * board, tags and comments, icon-first with few words. What shows depends on the caller's
 * permissions in the idea's project (decision 13): `ideas.status` (status and board), `ideas.tags`,
 * `ideas.merge` (merge duplicates, #37), `comments.moderate` (lock, official response), `ideas.delete`.
 */
import { Avatar, Button, Chip, Select, Switch, Tooltip, cn } from '@crazy-staff/ui'
import {
  ArrowDown,
  ArrowUp,
  CircleDot,
  GitMerge,
  LayoutList,
  Lock,
  MessageSquare,
  PinOff,
  Tags,
  type LucideIcon,
} from 'lucide-react'
import type { PublicPostDetailView } from '@/lib/client/queries/portal-detail'
import {
  lockCommentsFn,
  moveIdeaFn,
  pinCommentFn,
  setIdeaStatusFn,
  unmergeIdeaFn,
} from '@/lib/server/crazy/ideas-functions'
import { useState } from 'react'
import { m } from '../../paraglide/messages.js'
import { formatDate, useAct } from '../../lib/idea-act'
import type { HubProject } from '../../lib/projects'
import { AuthorLink } from '../author-link'
import { IconButton } from '../icon-button'
import { SidePanelSection, usePanelTouch } from '../side-panel'
import { MergeDialog } from './merge-dialog'
import { TagsDialog } from './tags-dialog'
import { countComments } from './comments'

export interface IdeaPermissions {
  status: boolean
  tags: boolean
  delete: boolean
  merge: boolean
  comments: boolean
}

/** One number of the idea at a glance: an icon and the number, the name in a tooltip. */
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
    <Tooltip content={label}>
      <div
        aria-label={`${label}: ${value}`}
        className={cn(
          'squircle flex items-center justify-center gap-1.5 rounded-control bg-surface-2 py-2.5 text-base font-semibold tabular-nums',
          tone === 'accent' && 'text-accent',
          tone === 'danger' && 'text-danger'
        )}
      >
        <Icon className={cn('size-4', !tone && 'text-muted')} strokeWidth={2.5} />
        {value}
      </div>
    </Tooltip>
  )
}

export function ModerationPanelContent({
  post,
  project,
  can,
  statuses,
  votes,
}: {
  post: PublicPostDetailView
  project: HubProject
  can: IdeaPermissions
  statuses: { id: string; name: string; color: string | null }[]
  votes: { up: number; down: number }
}) {
  const postId = post.id as string
  const act = useAct(postId)
  // in the phone drawer: larger controls for a finger
  const touch = usePanelTouch()
  const size = touch ? 'lg' : undefined
  const [merging, setMerging] = useState<'into' | 'here' | null>(null)
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
        <div className="flex items-center gap-2.5">
          <Avatar size="sm" src={post.authorAvatarUrl ?? undefined} name={post.authorName ?? '?'} />
          <AuthorLink principalId={post.principalId} className="truncate text-sm font-medium">
            {post.authorName ?? '—'}
          </AuthorLink>
          <span className="ms-auto shrink-0 text-xs text-muted">{formatDate(post.createdAt)}</span>
        </div>
      </div>

      {can.status && (
        <SidePanelSection label={m.ideas_status()} icon={CircleDot}>
          <Select
            size={size}
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
        <SidePanelSection label={m.ideas_board()} icon={LayoutList}>
          <Select
            size={size}
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
        <SidePanelSection
          label={m.ideas_tags()}
          icon={Tags}
          actions={
            <TagsDialog
              postId={postId}
              current={post.tags.map((t) => t.id)}
              moderator
              iconOnly
              iconSize={touch ? 'icon' : 'icon-sm'}
            />
          }
        >
          {post.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Chip key={tag.id} variant="neutral">
                  {tag.name}
                </Chip>
              ))}
            </div>
          ) : (
            <span className="text-sm text-muted">—</span>
          )}
        </SidePanelSection>
      )}

      {can.merge && (
        <SidePanelSection label={m.merge_section()} icon={GitMerge}>
          <div className="flex flex-col gap-2">
            {post.mergeInfo ? (
              <Button
                variant="outline"
                size={touch ? 'md' : 'sm'}
                onClick={() =>
                  void act(() => unmergeIdeaFn({ data: { postId } }), m.merge_unmerged())
                }
              >
                {m.merge_unmerge()}
              </Button>
            ) : (
              <>
                {!post.mergedPostCount && (
                  <Button
                    variant="outline"
                    size={touch ? 'md' : 'sm'}
                    onClick={() => setMerging('into')}
                  >
                    {m.merge_into()}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size={touch ? 'md' : 'sm'}
                  onClick={() => setMerging('here')}
                >
                  {m.merge_here()}
                </Button>
              </>
            )}
          </div>
          {merging && (
            <MergeDialog
              postId={postId}
              direction={merging}
              onClose={() => setMerging(null)}
              onMerged={() => act(async () => {}, m.merge_done())}
            />
          )}
        </SidePanelSection>
      )}
      {can.comments && (
        <SidePanelSection
          label={m.ideas_comments()}
          icon={MessageSquare}
          actions={
            post.pinnedComment ? (
              <IconButton
                label={m.ideas_unpin()}
                size={touch ? 'icon' : 'icon-sm'}
                onClick={() => act(() => pinCommentFn({ data: { postId, commentId: null } }))}
              >
                <PinOff />
              </IconButton>
            ) : undefined
          }
        >
          <Switch
            size={size}
            className={cn(touch && 'min-h-11')}
            label={
              <span className="flex items-center gap-2">
                <Lock className="size-4 text-muted" /> {m.ideas_lock_comments()}
              </span>
            }
            checked={!!post.isCommentsLocked}
            onCheckedChange={(locked) =>
              void act(() => lockCommentsFn({ data: { postId, locked } }))
            }
          />
        </SidePanelSection>
      )}
    </>
  )
}
