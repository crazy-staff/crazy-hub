/**
 * Public role badges next to names on an idea's page (#5, decision 13): the roles an admin marked
 * public (global ones and the idea's project's), as small soft chips after the name, like the "Team"
 * chip. One request per page for everyone on it (`getRoleBadgesFn`).
 */
import { Chip } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { PublicCommentView } from '@/lib/client/queries/portal-detail'
import { getRoleBadgesFn } from '@/lib/server/crazy/ideas-functions'

type Badges = Record<string, { slug: string; name: string }[]>

const BadgesContext = createContext<Badges>({})

/** Everyone who wrote on the page: the author and every comment's author, each once. */
export function peopleOnPage(
  authorId: string | null | undefined,
  comments: readonly PublicCommentView[]
): string[] {
  const ids = new Set<string>()
  if (authorId) ids.add(authorId)
  const walk = (list: readonly PublicCommentView[]) => {
    for (const comment of list) {
      if (comment.principalId) ids.add(comment.principalId)
      walk((comment.replies ?? []) as PublicCommentView[])
    }
  }
  walk(comments)
  return [...ids].sort()
}

export function RoleBadgesProvider({
  postId,
  principalIds,
  children,
}: {
  postId: string
  principalIds: string[]
  children: ReactNode
}) {
  const key = principalIds.join(',')
  const { data } = useQuery({
    queryKey: ['crazy', 'role-badges', postId, key],
    queryFn: () => getRoleBadgesFn({ data: { postId, principalIds } }),
    enabled: principalIds.length > 0,
    staleTime: 5 * 60_000,
    placeholderData: (previous) => previous,
  })
  const value = useMemo(() => data ?? {}, [data])
  return <BadgesContext value={value}>{children}</BadgesContext>
}

/** The person's public roles as chips; nothing when they have none. */
export function RoleBadges({ principalId }: { principalId: string | null | undefined }) {
  const badges = useContext(BadgesContext)[principalId ?? ''] ?? []
  return badges.map((badge) => (
    <Chip key={badge.slug} size="sm" variant="soft" data-role-badge={badge.slug}>
      {badge.name}
    </Chip>
  ))
}
