/**
 * Emoji reactions of a comment (#5): chips under the text (one per emoji with its count, pressed
 * when the viewer reacted, the names in a tooltip) and a picker in the comment's action row with
 * Quackback's fixed set of emojis. Optimistic; the idea refetches afterwards.
 */
import { Popover, Tooltip, cn, toast } from '@crazy-staff/ui'
import { useQueryClient } from '@tanstack/react-query'
import { SmilePlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { PostCommentId } from '@quackback/ids'
import type { CommentReactionCount } from '@/lib/shared/comment-tree'
import { REACTION_EMOJIS } from '@/lib/shared/db-types'
import { addReactionFn, removeReactionFn } from '@/lib/server/functions/comments'
import { m } from '../../paraglide/messages.js'
import { errorMessage } from '../../lib/admin'
import { IconButton } from '../icon-button'

/** The reactions after the viewer toggles `emoji` (pure, for the optimistic update). */
export function toggleReaction(
  list: readonly CommentReactionCount[],
  emoji: string
): CommentReactionCount[] {
  const found = list.find((r) => r.emoji === emoji)
  if (!found) return [...list, { emoji, count: 1, hasReacted: true }]
  const count = found.count + (found.hasReacted ? -1 : 1)
  return count <= 0
    ? list.filter((r) => r.emoji !== emoji)
    : list.map((r) => (r.emoji === emoji ? { ...r, count, hasReacted: !r.hasReacted } : r))
}

/** The reactions of one comment as shown, and toggling one (optimistic). */
export function useReactions(postId: string, commentId: string, reactions: CommentReactionCount[]) {
  const queryClient = useQueryClient()
  const [shown, setShown] = useState(reactions)
  useEffect(() => setShown(reactions), [reactions])
  const toggle = async (emoji: string) => {
    const before = shown
    const had = before.find((r) => r.emoji === emoji)?.hasReacted ?? false
    setShown(toggleReaction(before, emoji))
    try {
      const data = { commentId: commentId as PostCommentId, emoji }
      if (had) await removeReactionFn({ data })
      else await addReactionFn({ data })
      void queryClient.invalidateQueries({ queryKey: ['portal', 'post', postId] })
    } catch (err) {
      setShown(before)
      toast.error(errorMessage(err))
    }
  }
  return { shown, toggle }
}

/** One chip per emoji with its count; pressed when the viewer reacted, names in a tooltip. */
export function ReactionChips({
  reactions,
  canReact,
  onToggle,
}: {
  reactions: CommentReactionCount[]
  canReact: boolean
  onToggle: (emoji: string) => void
}) {
  if (reactions.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {reactions.map((r) => (
        <Tooltip
          key={r.emoji}
          content={r.reactors?.length ? r.reactors.join(', ') : `${r.emoji} ${r.count}`}
        >
          <button
            type="button"
            aria-pressed={r.hasReacted}
            aria-label={`${r.emoji} ${r.count}`}
            disabled={!canReact}
            onClick={() => onToggle(r.emoji)}
            className={cn(
              'squircle inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-chip border px-2 text-xs tabular-nums outline-none transition-colors',
              'focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default',
              r.hasReacted
                ? 'border-accent/60 bg-accent-soft text-accent-soft-foreground'
                : 'border-border bg-surface text-muted hover:bg-hover'
            )}
          >
            <span className="text-sm leading-none">{r.emoji}</span>
            {r.count}
          </button>
        </Tooltip>
      ))}
    </div>
  )
}

/** The icon button with Quackback's fixed set of emojis; sits in the comment's action row. */
export function ReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <IconButton label={m.ideas_react()} size="icon-sm" className="text-muted">
            <SmilePlus />
          </IconButton>
        }
      />
      <Popover.Content side="top" align="start" className="flex w-auto gap-1 p-1.5">
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            onClick={() => {
              setOpen(false)
              onPick(emoji)
            }}
            className="squircle flex size-9 cursor-pointer items-center justify-center rounded-control-sm text-lg outline-none transition-transform hover:scale-110 hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring motion-reduce:hover:scale-100"
          >
            {emoji}
          </button>
        ))}
      </Popover.Content>
    </Popover.Root>
  )
}
