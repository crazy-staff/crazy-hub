/**
 * Vote and post hooks of the ideas board (#5), on Quackback's server functions. Written here rather
 * than reusing `lib/client/mutations/portal-posts.ts`: that module imports the admin queries, which
 * pull the batched-read registry (and every admin server function) into the app's graph and break
 * the server-function manifest.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import type { BoardId } from '@quackback/ids'
import { createPublicPostFn } from '@/lib/server/functions/public-posts'
import { publicPostsKeys } from '@/lib/client/hooks/use-portal-posts-query'
import { getIdeaVotesFn, voteIdeaFn } from '@/lib/server/crazy/votes-functions'
import { applyVote, ideaScore, type IdeaVote } from '@/lib/shared/crazy/votes'

/** Downvote counts and the viewer's votes of the ideas on screen (one request per list page). */
export function useIdeaVotes(postIds: string[]) {
  return useQuery({
    queryKey: ['crazy', 'votes', postIds.join(',')],
    queryFn: () => getIdeaVotesFn({ data: { postIds } }),
    enabled: postIds.length > 0,
    staleTime: 30 * 1000,
  })
}

/**
 * Up/down vote of one idea, optimistic: the shown vote and score change at once, take the server's
 * answer when it comes and roll back on failure. `upvotes` is Quackback's `vote_count`.
 */
export function useIdeaVote(postId: string, upvotes: number, downvotes: number, mine: IdeaVote) {
  const queryClient = useQueryClient()
  const server = { vote: mine, score: ideaScore(upvotes, downvotes) }
  const [shown, setShown] = useState(server)
  // a refetch (or another page's vote) brings new numbers
  useEffect(() => setShown(server), [server.vote, server.score]) // eslint-disable-line react-hooks/exhaustive-deps

  const mutation = useMutation({
    mutationFn: (direction: 'up' | 'down') => voteIdeaFn({ data: { postId, direction } }),
    onMutate: (direction) => {
      const before = shown
      const change = applyVote(before.vote, direction)
      setShown({ vote: change.next, score: before.score + change.delta })
      return { before }
    },
    onError: (_err, _direction, context) => {
      if (context) setShown(context.before)
    },
    onSuccess: (result) => {
      setShown({ vote: result.vote, score: result.score })
      void queryClient.invalidateQueries({ queryKey: ['crazy', 'votes'] })
    },
  })

  return {
    vote: shown.vote,
    score: shown.score,
    isPending: mutation.isPending,
    press: (direction: 'up' | 'down') => mutation.mutate(direction),
  }
}

/** Posts an idea; the lists refetch afterwards. */
export function useCreateIdea() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      boardId: string
      title: string
      content: string
      contentJson?: unknown
    }) =>
      createPublicPostFn({
        data: {
          boardId: input.boardId as BoardId,
          title: input.title,
          content: input.content,
          contentJson: input.contentJson as never,
        },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: publicPostsKeys.lists() }),
  })
}
