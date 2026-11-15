/**
 * The subscribe bell of an idea (#5): an icon button that follows the idea (all activity or status
 * changes only) or stops following it, through Quackback's subscriptions. Voting and commenting
 * subscribe automatically there, so the bell often starts on.
 */
import { DropdownMenu, toast } from '@crazy-staff/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, BellRing, Check } from 'lucide-react'
import type { PostId } from '@quackback/ids'
import { getVoteSidebarDataFn } from '@/lib/server/functions/public-posts'
import {
  subscribeToPostFn,
  unsubscribeFromPostFn,
  updateSubscriptionLevelFn,
} from '@/lib/server/functions/subscriptions'
import { m } from '../../paraglide/messages.js'
import { errorMessage } from '../../lib/admin'
import { IconButton } from '../icon-button'

export function FollowButton({ postId }: { postId: string }) {
  const queryClient = useQueryClient()
  const key = ['crazy', 'follow', postId]
  const status = useQuery({
    queryKey: key,
    queryFn: () => getVoteSidebarDataFn({ data: { postId: postId as PostId } }),
  }).data?.subscriptionStatus
  const level = status?.subscribed ? status.level : 'none'

  const set = async (next: 'all' | 'status_only' | 'none') => {
    try {
      if (next === 'none') await unsubscribeFromPostFn({ data: { postId } })
      // subscribing keeps an existing level, so a follower switches it instead
      else if (level !== 'none') await updateSubscriptionLevelFn({ data: { postId, level: next } })
      else await subscribeToPostFn({ data: { postId, level: next, reason: 'manual' } })
      await queryClient.invalidateQueries({ queryKey: key })
      toast.success(next === 'none' ? m.ideas_unfollowed() : m.ideas_followed())
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }

  const label = level === 'none' ? m.ideas_follow() : m.ideas_following()
  const item = (value: 'all' | 'status_only', text: string) => (
    <DropdownMenu.Item onClick={() => void set(value)}>
      {level === value ? <Check /> : <span className="size-4" />} {text}
    </DropdownMenu.Item>
  )
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        render={
          <IconButton label={label} className={level === 'none' ? undefined : 'text-accent'}>
            {level === 'none' ? <Bell /> : <BellRing />}
          </IconButton>
        }
      />
      <DropdownMenu.Content align="end">
        {item('all', m.ideas_follow_all())}
        {item('status_only', m.ideas_follow_status())}
        {level !== 'none' && (
          <DropdownMenu.Item onClick={() => void set('none')}>
            <BellOff /> {m.ideas_unfollow()}
          </DropdownMenu.Item>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
