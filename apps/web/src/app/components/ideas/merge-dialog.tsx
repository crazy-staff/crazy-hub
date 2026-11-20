/**
 * Picking the other idea of a merge (#37): "Merge into…" picks the idea this one duplicates, "Merge
 * others here" picks a duplicate of this one. Ideas of the same project, oldest first (the first
 * idea is the canonical one by default); without a search the idea's own title finds the likely
 * duplicates. The rows are radio buttons; the dialog's button merges.
 */
import { Input, cn } from '@crazy-staff/ui'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Check, Search } from 'lucide-react'
import { useState } from 'react'
import { getMergeCandidatesFn, mergeIdeaFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { FormDialog } from '../form-dialog'
import { formatDate } from '../../lib/idea-act'
import { useDebouncedValue } from '../../lib/use-debounced'

export function MergeDialog({
  postId,
  direction,
  onClose,
  onMerged,
}: {
  postId: string
  direction: 'into' | 'here'
  onClose: () => void
  onMerged: () => Promise<unknown>
}) {
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const settled = useDebouncedValue(query.trim(), 250)
  const { data: candidates = [], isFetching } = useQuery({
    queryKey: ['crazy', 'merge-candidates', postId, direction, settled],
    queryFn: () => getMergeCandidatesFn({ data: { postId, query: settled, direction } }),
    placeholderData: keepPreviousData,
  })
  return (
    <FormDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={direction === 'into' ? m.merge_into_title() : m.merge_here_title()}
      submitLabel={m.merge_submit()}
      dirty={picked !== null}
      onSubmit={async () => {
        if (!picked) throw new Error(m.merge_pick_first())
        await mergeIdeaFn({
          data:
            direction === 'into'
              ? { postId, canonicalId: picked }
              : { postId: picked, canonicalId: postId },
        })
        await onMerged()
      }}
    >
      <p className="text-sm text-muted">
        {direction === 'into' ? m.merge_into_text() : m.merge_here_text()}
      </p>
      <div className="relative">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          type="search"
          aria-label={m.merge_search()}
          placeholder={m.merge_search()}
          className="ps-9"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
      </div>
      <div
        role="radiogroup"
        aria-label={m.merge_candidates()}
        aria-busy={isFetching || undefined}
        className="flex min-h-40 flex-col gap-1"
      >
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{m.merge_none()}</p>
        ) : (
          candidates.map((idea) => {
            const on = picked === idea.id
            return (
              <button
                key={idea.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setPicked(on ? null : idea.id)}
                className={cn(
                  'squircle flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-control-sm px-3 py-2 text-start outline-none max-sm:min-h-12',
                  'transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                  on ? 'bg-accent-soft text-foreground' : 'hover:bg-hover'
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">{idea.title}</span>
                  <span className="text-xs text-muted">
                    {formatDate(idea.createdAt)} · {m.merge_votes({ count: idea.voteCount })}
                  </span>
                </span>
                {on && <Check className="size-4 shrink-0 text-accent" />}
              </button>
            )
          })
        )}
      </div>
    </FormDialog>
  )
}
