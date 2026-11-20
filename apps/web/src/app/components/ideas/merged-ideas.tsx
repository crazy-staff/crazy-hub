/**
 * "Merged ideas" on the canonical idea (#37): the duplicates merged into it, in merge order, with
 * their author and votes, each linking to its page (which says where it went). Moderators with
 * `ideas.merge` can unmerge one from here.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowUp, GitMerge, Undo2 } from 'lucide-react'
import { getMergedIdeasFn, unmergeIdeaFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { formatDate, useAct } from '../../lib/idea-act'
import { IconButton } from '../icon-button'

export function MergedIdeas({
  postId,
  project,
  canUnmerge,
}: {
  postId: string
  project: string
  canUnmerge: boolean
}) {
  const act = useAct(postId)
  const { data: merged = [] } = useQuery({
    // under the idea's own key, so a change on the page refreshes it too
    queryKey: ['portal', 'post', postId, 'merged'],
    queryFn: () => getMergedIdeasFn({ data: { postId } }),
  })
  if (merged.length === 0) return null
  return (
    <section aria-labelledby={`${postId}-merged`} className="flex flex-col gap-3">
      <h2 id={`${postId}-merged`} className="flex items-center gap-2 text-sm font-semibold">
        <GitMerge className="size-4 text-muted" />
        {m.merge_list_title()}
        <span className="font-normal text-muted tabular-nums">{merged.length}</span>
      </h2>
      <ul className="flex flex-col gap-1">
        {merged.map((idea) => (
          <li
            key={idea.id}
            className="squircle flex min-h-11 items-center gap-3 rounded-control-sm px-3 py-1.5 hover:bg-hover"
          >
            <Link
              to="/$project/ideas/$postId"
              params={{ project, postId: idea.id }}
              className="flex min-w-0 flex-1 flex-col outline-none focus-visible:underline"
            >
              <span className="truncate text-sm font-medium">{idea.title}</span>
              <span className="text-xs text-muted">
                {m.merge_list_meta({
                  author: idea.authorName ?? '—',
                  date: formatDate(idea.mergedAt),
                })}
              </span>
            </Link>
            <span
              className="flex shrink-0 items-center gap-1 text-xs text-muted tabular-nums"
              aria-label={m.merge_votes({ count: idea.voteCount })}
            >
              <ArrowUp className="size-3.5" /> {idea.voteCount}
            </span>
            {canUnmerge && (
              <IconButton
                label={m.merge_unmerge()}
                size="icon-sm"
                onClick={() =>
                  void act(() => unmergeIdeaFn({ data: { postId: idea.id } }), m.merge_unmerged())
                }
              >
                <Undo2 />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
