/** Shared helpers of the idea page and its parts (comments, moderation panel). */
import { toast } from '@crazy-staff/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { publicPostsKeys } from '@/lib/client/hooks/use-portal-posts-query'
import { errorMessage } from './admin'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
export const formatDate = (value: Date | string) => dateFormat.format(new Date(value))

/** Runs a change, refreshes the idea and the lists; failures show as a toast. */
export function useAct(postId: string) {
  const queryClient = useQueryClient()
  return async (run: () => Promise<unknown>, success?: string) => {
    try {
      await run()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portal', 'post', postId] }),
        queryClient.invalidateQueries({ queryKey: publicPostsKeys.lists() }),
      ])
      if (success) toast.success(success)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }
}

/** The signed-in person in crazy-hub's context, or null. */
export function useMe() {
  return useRouteContext({ from: '__root__', select: (c) => c.hub.me })
}
