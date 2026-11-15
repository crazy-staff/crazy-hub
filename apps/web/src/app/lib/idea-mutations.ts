/**
 * Vote and post hooks of the ideas board (#5), on Quackback's server functions. Written here rather
 * than reusing `lib/client/mutations/portal-posts.ts`: that module imports the admin queries, which
 * pull the batched-read registry (and every admin server function) into the app's graph and break
 * the server-function manifest.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardId, PostId } from '@quackback/ids'
import { createPublicPostFn, toggleVoteFn } from '@/lib/server/functions/public-posts'
import {
  fetchVotedPosts,
  publicPostsKeys,
  votedPostsKeys,
} from '@/lib/client/hooks/use-portal-posts-query'

const voteCountKey = (postId: string) => ['voteCount', postId] as const

/** Optimistic upvote of one idea: count and voted state, rolled back on failure. */
export function useIdeaVote(postId: string, voteCount: number) {
  const queryClient = useQueryClient()
  const { data: count = voteCount } = useQuery({
    queryKey: voteCountKey(postId),
    queryFn: () => voteCount,
    initialData: voteCount,
    staleTime: Infinity,
  })
  const { data: voted } = useQuery({
    queryKey: votedPostsKeys.byWorkspace(),
    queryFn: fetchVotedPosts,
    staleTime: 5 * 60 * 1000,
  })
  const hasVoted = voted?.has(postId) ?? false

  const mutation = useMutation({
    mutationFn: () => toggleVoteFn({ data: { postId: postId as PostId } }),
    onMutate: () => {
      const next = !hasVoted
      queryClient.setQueryData<number>(
        voteCountKey(postId),
        (old) => (old ?? voteCount) + (next ? 1 : -1)
      )
      queryClient.setQueryData<Set<string>>(votedPostsKeys.byWorkspace(), (old) => {
        const set = new Set(old ?? [])
        if (next) set.add(postId)
        else set.delete(postId)
        return set
      })
      return { next }
    },
    onError: (_err, _vars, context) => {
      if (!context) return
      queryClient.setQueryData<number>(
        voteCountKey(postId),
        (old) => (old ?? voteCount) + (context.next ? -1 : 1)
      )
      queryClient.setQueryData<Set<string>>(votedPostsKeys.byWorkspace(), (old) => {
        const set = new Set(old ?? [])
        if (context.next) set.delete(postId)
        else set.add(postId)
        return set
      })
    },
    onSuccess: (result) => {
      queryClient.setQueryData<number>(voteCountKey(postId), result.voteCount)
    },
  })

  return {
    voteCount: count,
    hasVoted,
    isPending: mutation.isPending,
    toggle: () => mutation.mutate(),
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
