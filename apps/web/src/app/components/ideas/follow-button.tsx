/**
 * The subscribe bell of an idea (#5): an icon button that follows the idea (all activity or status
 * changes only) or stops following it, through Quackback's subscriptions. Voting and commenting
 * subscribe automatically there, so the bell often starts on.
 */
import { toast } from '@crazy-staff/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, BellOff, BellRing } from 'lucide-react'
import type { PostId } from '@quackback/ids'
import { getVoteSidebarDataFn } from '@/lib/server/functions/public-posts'
import {
  subscribeToPostFn,
  unsubscribeFromPostFn,
  updateSubscriptionLevelFn,
} from '@/lib/server/functions/subscriptions'
import { m } from '../../paraglide/messages.js'
import { toastError } from '../../lib/admin'
import { AdaptiveMenu } from '../adaptive'
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
      toastError(err)
    }
  }

  const label = level === 'none' ? m.ideas_follow() : m.ideas_following()
  return (
    <AdaptiveMenu
      title={label}
      trigger={
        <IconButton label={label} className={level === 'none' ? undefined : 'text-accent'}>
          {level === 'none' ? <Bell /> : <BellRing />}
        </IconButton>
      }
      entries={[
        {
          label: m.ideas_follow_all(),
          icon: <BellRing />,
          checked: level === 'all',
          onSelect: () => void set('all'),
        },
        {
          label: m.ideas_follow_status(),
          icon: <Bell />,
          checked: level === 'status_only',
          onSelect: () => void set('status_only'),
        },
        ...(level !== 'none'
          ? [{ label: m.ideas_unfollow(), icon: <BellOff />, onSelect: () => void set('none') }]
          : []),
      ]}
    />
  )
}
