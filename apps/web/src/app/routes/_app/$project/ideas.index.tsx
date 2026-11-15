import {
  Button,
  Checkbox,
  DropdownMenu,
  Empty,
  Input,
  Skeleton,
  Tabs,
  ToggleGroup,
  cn,
} from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { Filter, Lightbulb, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { flattenPublicPosts, usePublicPosts } from '@/lib/client/hooks/use-portal-posts-query'
import { useSessionContext } from '@/lib/client/hooks/use-root-context'
import { m } from '../../../paraglide/messages.js'
import { Page } from '../../../components/page'
import { IdeaCard } from '../../../components/ideas/idea-card'
import { NewIdeaWizard } from '../../../components/ideas/new-idea-wizard'
import { Appear } from '../../../components/appear'
import { openSignIn } from '../../../components/auth/auth-dialog'
import { IDEA_SORTS, groupTags, parseIdeasSearch, type IdeasSearch } from '../../../lib/ideas'
import { SECTION_META } from '../../../lib/projects'

/**
 * A project's ideas (#5): the posts of its boards, sorted, searched and filtered by status and tags
 * (grouped by `kind: value`). Several boards show as tabs. The filters live in the URL.
 */
export const Route = createFileRoute('/_app/$project/ideas/')({
  validateSearch: (raw: Record<string, unknown>): IdeasSearch => parseIdeasSearch(raw),
  beforeLoad: ({ context }) => {
    if (!context.project.sections.includes('ideas')) throw notFound()
  },
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(portalQueries.statuses()),
      context.queryClient.ensureQueryData(portalQueries.tags()),
    ]),
  head: ({ match }) => ({
    meta: [{ title: `${SECTION_META.ideas.label()} · ${match.context.project.name}` }],
  }),
  component: Ideas,
})

const SORT_LABEL = { top: m.ideas_sort_top, new: m.ideas_sort_new, trending: m.ideas_sort_trending }

function Ideas() {
  const { project } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const session = useSessionContext()
  const signedIn = !!session?.user && session.user.principalType !== 'anonymous'
  const [creating, setCreating] = useState(false)

  const board = project.boards.find((b) => b.slug === search.board) ?? project.boards[0]
  const statuses = useQuery(portalQueries.statuses()).data ?? []
  const tags = useQuery(portalQueries.tags()).data ?? []
  const tagGroups = useMemo(() => groupTags(tags), [tags])

  const setSearch = (patch: Partial<IdeasSearch>) =>
    void navigate({ search: (prev) => parseIdeasSearch({ ...prev, ...patch }), replace: true })

  const posts = usePublicPosts({
    filters: {
      board: board?.slug,
      sort: search.sort ?? 'top',
      search: search.q,
      status: search.status,
      tagIds: search.tag,
    },
    enabled: !!board,
  })
  const items = flattenPublicPosts(posts.data)
  const statusOf = (id: string | null) => statuses.find((s) => s.id === id)

  // load the next page when the end of the list comes into view
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && posts.hasNextPage && !posts.isFetchingNextPage) {
        void posts.fetchNextPage()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [posts])

  const activeFilters = (search.status?.length ?? 0) + (search.tag?.length ?? 0)
  const toggle = (key: 'status' | 'tag', id: string, on: boolean) => {
    const list = new Set(search[key] ?? [])
    if (on) list.add(id)
    else list.delete(id)
    setSearch({ [key]: [...list] })
  }

  return (
    <Page
      title={SECTION_META.ideas.label()}
      description={SECTION_META.ideas.description()}
      actions={
        board && (
          <Button
            onClick={() =>
              signedIn ? setCreating(true) : void navigate({ to: '.', search: openSignIn })
            }
          >
            <Plus /> {m.ideas_new()}
          </Button>
        )
      }
    >
      {project.boards.length > 1 && (
        <Tabs
          value={board?.slug}
          onValueChange={(value) => setSearch({ board: String(value) })}
          items={project.boards.map((b) => ({ value: b.slug, label: b.name, content: null }))}
          classNames={{ panel: 'hidden' }}
        />
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ToggleGroup
          aria-label={m.ideas_sort()}
          value={[search.sort ?? 'top']}
          onValueChange={(value) => {
            const next = value[0] as (typeof IDEA_SORTS)[number] | undefined
            if (next) setSearch({ sort: next })
          }}
          items={IDEA_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s]() }))}
        />
        <SearchBox value={search.q ?? ''} onChange={(q) => setSearch({ q })} />
        <DropdownMenu.Root>
          <DropdownMenu.Trigger
            render={<Button variant="outline" size="sm" />}
            aria-label={m.ideas_filters()}
          >
            <Filter /> {m.ideas_filters()}
            {activeFilters > 0 && (
              <span className="rounded-chip bg-accent-soft px-1.5 text-xs text-accent-soft-foreground">
                {activeFilters}
              </span>
            )}
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end" className="max-h-[70vh] w-72 overflow-y-auto p-2">
            <FilterGroup label={m.ideas_status()}>
              {statuses.map((status) => (
                <Checkbox
                  key={status.id}
                  label={status.name}
                  checked={search.status?.includes(status.id) ?? false}
                  onCheckedChange={(on) => toggle('status', status.id, on)}
                />
              ))}
            </FilterGroup>
            {tagGroups.map((group) => (
              <FilterGroup key={group.kind ?? '-'} label={group.kind ?? m.ideas_tags()}>
                {group.tags.map((tag) => (
                  <Checkbox
                    key={tag.id}
                    label={tag.value}
                    checked={search.tag?.includes(tag.id) ?? false}
                    onCheckedChange={(on) => toggle('tag', tag.id, on)}
                  />
                ))}
              </FilterGroup>
            ))}
            {activeFilters > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 w-full"
                onClick={() => setSearch({ status: [], tag: [] })}
              >
                {m.ideas_clear_filters()}
              </Button>
            )}
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </div>

      {!board ? (
        <Empty icon={<Lightbulb />} title={m.ideas_no_board()} />
      ) : posts.isPending ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 rounded-card" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty
          icon={<Lightbulb />}
          title={search.q || activeFilters ? m.ideas_none_found() : m.ideas_empty()}
          description={search.q || activeFilters ? undefined : m.ideas_empty_text()}
        />
      ) : (
        <Appear className={cn('flex flex-col gap-3', posts.isFetching && 'opacity-80')}>
          {items.map((post) => (
            <IdeaCard
              key={post.id}
              post={post}
              project={project.slug}
              status={post.statusId ? statusOf(post.statusId) : undefined}
            />
          ))}
          <div ref={sentinel} />
          {posts.isFetchingNextPage && <Skeleton className="h-24 rounded-card" />}
        </Appear>
      )}
      {creating && (
        <NewIdeaWizard project={project} boardId={board?.id} onClose={() => setCreating(false)} />
      )}
    </Page>
  )
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 px-1 py-2">
      <span className="text-xs font-medium text-muted capitalize">{label}</span>
      {children}
    </div>
  )
}

/** Search as you type, written to the URL after a short pause. */
function SearchBox({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft.trim()), 300)
    return () => clearTimeout(timer)
  }, [draft, value, onChange])
  return (
    <div className="relative ms-auto w-full max-w-64">
      <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input
        size="sm"
        type="search"
        aria-label={m.ideas_search()}
        placeholder={m.ideas_search()}
        className="ps-8"
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
      />
    </div>
  )
}
