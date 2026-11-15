import { Avatar, Button, Card, Chip, Empty } from '@crazy-staff/ui'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { Lightbulb, MessageSquare, Reply, UserRound, type LucideIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getPublicUserProfileFn } from '@/lib/server/functions/public-profile'
import { getProfileActivityFn } from '@/lib/server/crazy/profile-functions'
import type { ProfileActivityItem } from '@/lib/server/crazy/profile-activity.service'
import { formatDate } from '../../lib/idea-act'
import { getLocale } from '../../paraglide/runtime.js'
import { m } from '../../paraglide/messages.js'
import { Page } from '../../components/page'

/**
 * A person's public profile: name, avatar, team badge, counts and recent activity (ideas, comments
 * and replies with an excerpt, newest first), so anyone can read what they wrote before.
 */
export const Route = createFileRoute('/_app/u/$principalId')({
  loader: async ({ params, context }) => {
    const [profile, activity] = await Promise.all([
      getPublicUserProfileFn({ data: { principalId: params.principalId } }).catch(() => null),
      getProfileActivityFn({ data: { principalId: params.principalId } }).catch(() => null),
    ])
    const empty = { commentCount: 0, items: [], next: null }
    // Quackback hides a profile without any activity; your own opens anyway (from the account menu)
    const user = context.session?.user
    if (!profile && user && context.hub.me?.principalId === params.principalId) {
      return {
        principalId: params.principalId,
        displayName: user.name || user.email,
        avatarUrl: user.image ?? null,
        isTeamMember: false,
        joinedAt: new Date(user.createdAt ?? Date.now()).toISOString(),
        postCount: 0,
        commentCount: 0,
        voteCount: 0,
        activity: activity ?? empty,
      }
    }
    if (!profile) throw notFound()
    return { ...profile, activity: activity ?? empty }
  },
  // a hover on an author's name preloads the profile; opening it still shows what they wrote since
  staleTime: 0,
  preloadStaleTime: 0,
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.displayName ?? ''} · crazy-hub` }] }),
  component: PublicProfile,
})

const KIND: Record<ProfileActivityItem['kind'], { icon: LucideIcon; label: () => string }> = {
  idea: { icon: Lightbulb, label: () => m.profile_kind_idea() },
  comment: { icon: MessageSquare, label: () => m.profile_kind_comment() },
  reply: { icon: Reply, label: () => m.profile_kind_reply() },
}

function ActivityRow({ item }: { item: ProfileActivityItem }) {
  const kind = KIND[item.kind]
  const Icon = kind.icon
  const title = <span className="font-medium text-foreground">{item.postTitle}</span>
  return (
    <li className="flex gap-3 py-4 first:pt-0 last:pb-0">
      <span className="squircle mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-2 text-muted">
        <Icon className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>{kind.label()}</span>
          {item.projectSlug ? (
            <Link
              to="/$project/ideas/$postId"
              params={{ project: item.projectSlug, postId: item.postId }}
              hash={item.commentId ? `comment-${item.commentId}` : undefined}
              className="min-w-0 truncate hover:underline"
            >
              {title}
            </Link>
          ) : (
            title
          )}
          {item.projectName && (
            <Chip size="sm" variant="neutral">
              {item.projectName}
            </Chip>
          )}
          <span className="ms-auto shrink-0 text-xs">{formatDate(item.createdAt)}</span>
        </div>
        {item.excerpt && (
          <p className="line-clamp-3 text-sm break-words whitespace-pre-line">{item.excerpt}</p>
        )}
      </div>
    </li>
  )
}

function PublicProfile() {
  const p = Route.useLoaderData()
  const [items, setItems] = useState(p.activity.items)
  const [next, setNext] = useState(p.activity.next)
  // the loader refreshes (another profile, or newer data after a preload): start from its page
  useEffect(() => {
    setItems(p.activity.items)
    setNext(p.activity.next)
  }, [p.activity])
  const [loading, setLoading] = useState(false)
  const more = async () => {
    if (!next) return
    setLoading(true)
    try {
      const page = await getProfileActivityFn({
        data: { principalId: p.principalId, before: next },
      })
      setItems((list) => [...list, ...page.items])
      setNext(page.next)
    } finally {
      setLoading(false)
    }
  }
  const joined = new Date(p.joinedAt).toLocaleDateString(getLocale(), {
    year: 'numeric',
    month: 'long',
  })
  return (
    <Page
      title={
        <span className="inline-flex items-center gap-4">
          <Avatar size="lg" src={p.avatarUrl ?? undefined} name={p.displayName} />
          {p.displayName}
        </span>
      }
      actions={p.isTeamMember ? <Chip>{m.profile_team()}</Chip> : undefined}
      description={m.profile_joined({ date: joined })}
    >
      <div className="grid grid-cols-3 gap-3">
        {[
          [m.profile_posts(), p.postCount],
          [m.profile_comments(), p.activity.commentCount],
          [m.profile_votes(), p.voteCount],
        ].map(([label, count]) => (
          <Card key={label as string} className="p-4">
            <div className="text-2xl font-semibold tabular-nums">{count}</div>
            <div className="text-sm text-muted">{label}</div>
          </Card>
        ))}
      </div>
      <Card title={m.profile_activity()}>
        {items.length === 0 ? (
          <Empty icon={<UserRound />} title={m.profile_no_activity()} />
        ) : (
          <>
            <ul className="flex flex-col divide-y divide-border">
              {items.map((item) => (
                <ActivityRow key={item.commentId ?? item.postId} item={item} />
              ))}
            </ul>
            {next && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" size="sm" onClick={() => void more()} disabled={loading}>
                  {m.profile_more()}
                </Button>
              </div>
            )}
          </>
        )}
      </Card>
    </Page>
  )
}
