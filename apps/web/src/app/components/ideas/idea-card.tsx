/**
 * One idea in the list (#5): vote button, title, a line of the text, status, tags and who/when.
 */
import { Card, Chip } from '@crazy-staff/ui'
import { Link } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import type { PublicPostListItem } from '@/lib/shared/types'
import type { IdeaVote } from '@/lib/shared/crazy/votes'
import { excerpt } from '../../lib/ideas'
import { StatusChip } from './status-chip'
import { VoteButton } from './vote-button'
import { AuthorLink } from '../author-link'

export interface StatusInfo {
  id: string
  name: string
  color: string | null
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })

export function IdeaCard({
  post,
  project,
  status,
  upvotes,
  downvotes,
  mine,
  showBoard,
}: {
  post: PublicPostListItem
  project: string
  status?: StatusInfo
  /** Fresher upvotes than the cached list page (from the votes query). */
  upvotes?: number
  downvotes?: number
  mine?: IdeaVote
  /** Show the board's name (the "All boards" view). */
  showBoard?: boolean
}) {
  return (
    <Card.Root interactive className="relative flex items-start gap-5 p-5">
      <div className="relative z-10">
        <VoteButton
          postId={post.id}
          voteCount={upvotes ?? post.voteCount}
          downvotes={downvotes}
          mine={mine}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <Link
          to="/$project/ideas/$postId"
          params={{ project, postId: post.id }}
          className="flex flex-col gap-2 rounded-control-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="font-semibold">{post.title}</span>
          {post.content && (
            <span className="line-clamp-2 text-sm text-muted">{excerpt(post.content, 240)}</span>
          )}
        </Link>
        <span className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted">
          {showBoard && post.board && (
            <Chip size="sm" variant="outline">
              {post.board.name}
            </Chip>
          )}
          {status && <StatusChip name={status.name} color={status.color} />}
          {post.tags.map((tag) => (
            <Chip key={tag.id} size="sm" variant="neutral">
              {tag.name}
            </Chip>
          ))}
          <span className="ms-1">
            <AuthorLink principalId={post.principalId}>{post.authorName ?? '—'}</AuthorLink> ·{' '}
            {dateFormat.format(new Date(post.createdAt))}
          </span>
          <span className="ms-auto inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {post.commentCount}
          </span>
        </span>
      </div>
    </Card.Root>
  )
}
