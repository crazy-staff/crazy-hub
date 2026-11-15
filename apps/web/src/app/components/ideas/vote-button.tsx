/**
 * Up/down vote of an idea (#5): an up arrow, the score (upvotes minus downvotes, may go below zero)
 * and a down arrow in one column. The chosen arrow is in the accent (up) or danger (down) colour;
 * pressing it again takes the vote back, pressing the other one switches. Visitors are sent to sign
 * in first (anonymous voting is off).
 */
import { cn } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useSessionContext } from '@/lib/client/hooks/use-root-context'
import type { IdeaVote } from '@/lib/shared/crazy/votes'
import { m } from '../../paraglide/messages.js'
import { openSignIn } from '../auth/auth-dialog'
import { useIdeaVote } from '../../lib/idea-mutations'

export function VoteButton({
  postId,
  voteCount,
  downvotes = 0,
  mine = null,
  size = 'md',
}: {
  postId: string
  /** Upvotes (Quackback's `vote_count`). */
  voteCount: number
  downvotes?: number
  mine?: IdeaVote
  size?: 'md' | 'lg'
}) {
  const session = useSessionContext()
  const navigate = useNavigate()
  const signedIn = !!session?.user && session.user.principalType !== 'anonymous'
  const vote = useIdeaVote(postId, voteCount, downvotes, mine)

  const press = (direction: 'up' | 'down') => (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!signedIn) {
      void navigate({ to: '.', search: openSignIn })
      return
    }
    vote.press(direction)
  }
  const arrow = cn(
    'squircle flex w-full flex-1 cursor-pointer items-center justify-center rounded-control-sm outline-none',
    'transition-colors duration-[var(--cui-duration-fast)] ease-ui hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring',
    'disabled:cursor-default'
  )

  return (
    <div
      className={cn(
        'squircle flex shrink-0 flex-col items-center rounded-control border p-0.5 font-semibold tabular-nums transition-colors',
        size === 'lg' ? 'h-24 w-14 text-base' : 'h-20 w-12 text-sm',
        vote.vote === 'up' && 'border-accent bg-accent-soft/60',
        vote.vote === 'down' && 'border-danger/60 bg-danger/8',
        vote.vote === null && 'border-border bg-surface'
      )}
    >
      <button
        type="button"
        aria-pressed={vote.vote === 'up'}
        aria-label={vote.vote === 'up' ? m.ideas_unvote() : m.ideas_vote()}
        disabled={vote.isPending}
        onClick={press('up')}
        className={cn(arrow, vote.vote === 'up' ? 'text-accent' : 'text-muted')}
      >
        <ChevronUp className="size-4" strokeWidth={vote.vote === 'up' ? 3 : 2} />
      </button>
      <span
        className={cn(
          'leading-none',
          vote.vote === 'up' && 'text-accent-soft-foreground',
          vote.vote === 'down' && 'text-danger'
        )}
        aria-label={m.ideas_score({ score: vote.score })}
        data-testid="idea-score"
      >
        {vote.score}
      </span>
      <button
        type="button"
        aria-pressed={vote.vote === 'down'}
        aria-label={vote.vote === 'down' ? m.ideas_undownvote() : m.ideas_downvote()}
        disabled={vote.isPending}
        onClick={press('down')}
        className={cn(arrow, vote.vote === 'down' ? 'text-danger' : 'text-muted')}
      >
        <ChevronDown className="size-4" strokeWidth={vote.vote === 'down' ? 3 : 2} />
      </button>
    </div>
  )
}
