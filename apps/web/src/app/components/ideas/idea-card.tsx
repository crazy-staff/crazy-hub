/**
 * One idea in the list (#5): vote button, title, a line of the text, status, tags and who/when.
 */
import { Card, Chip } from '@crazy-staff/ui'
import { Link } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import type { PublicPostListItem } from '@/lib/shared/types'
import { excerpt } from '../../lib/ideas'
import { StatusChip } from './status-chip'
import { VoteButton } from './vote-button'

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
}: {
  post: PublicPostListItem
  project: string
  status?: StatusInfo
}) {
  return (
    <Card.Root interactive className="relative flex items-start gap-4 p-4">
      <div className="relative z-10">
        <VoteButton postId={post.id} voteCount={post.voteCount} />
      </div>
      <Link
        to="/$project/ideas/$postId"
        params={{ project, postId: post.id }}
        className="flex min-w-0 flex-1 flex-col gap-1.5 rounded-control-sm outline-none after:absolute after:inset-0 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="font-semibold">{post.title}</span>
        {post.content && (
          <span className="line-clamp-2 text-sm text-muted">{excerpt(post.content, 240)}</span>
        )}
        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {status && <StatusChip name={status.name} color={status.color} />}
          {post.tags.map((tag) => (
            <Chip key={tag.id} size="sm" variant="neutral">
              {tag.name}
            </Chip>
          ))}
          <span className="ms-1">
            {post.authorName ?? '—'} · {dateFormat.format(new Date(post.createdAt))}
          </span>
          <span className="ms-auto inline-flex items-center gap-1">
            <MessageSquare className="size-3.5" />
            {post.commentCount}
          </span>
        </span>
      </Link>
    </Card.Root>
  )
}
