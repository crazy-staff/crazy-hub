/**
 * Upvote button of an idea (#5): the score under an arrow, accent when the viewer has voted. Visitors
 * are sent to sign in first (anonymous voting is off). Downvotes join in part 2 of #5.
 */
import { cn } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronUp } from 'lucide-react'
import { useSessionContext } from '@/lib/client/hooks/use-root-context'
import { m } from '../../paraglide/messages.js'
import { openSignIn } from '../auth/auth-dialog'
import { useIdeaVote } from '../../lib/idea-mutations'

export function VoteButton({
  postId,
  voteCount,
  size = 'md',
}: {
  postId: string
  voteCount: number
  size?: 'md' | 'lg'
}) {
  const session = useSessionContext()
  const navigate = useNavigate()
  const signedIn = !!session?.user && session.user.principalType !== 'anonymous'
  const vote = useIdeaVote(postId, voteCount)
  return (
    <button
      type="button"
      aria-pressed={vote.hasVoted}
      aria-label={vote.hasVoted ? m.ideas_unvote() : m.ideas_vote()}
      disabled={vote.isPending}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (!signedIn) {
          void navigate({ to: '.', search: openSignIn })
          return
        }
        vote.toggle()
      }}
      className={cn(
        'squircle flex shrink-0 flex-col items-center justify-center rounded-control border font-semibold tabular-nums outline-none',
        'transition-colors duration-[var(--cui-duration-fast)] ease-ui focus-visible:ring-2 focus-visible:ring-ring',
        size === 'lg' ? 'h-16 w-14 text-base' : 'h-14 w-12 text-sm',
        vote.hasVoted
          ? 'border-accent bg-accent-soft text-accent-soft-foreground'
          : 'border-border bg-surface hover:bg-hover'
      )}
    >
      <ChevronUp className="size-4" />
      {vote.voteCount}
    </button>
  )
}
