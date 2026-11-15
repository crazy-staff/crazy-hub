import {
  Button,
  Checkbox,
  Chip,
  Collapsible,
  Empty,
  Input,
  Popover,
  Skeleton,
  Tabs,
  ToggleGroup,
  cn,
} from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { Filter, Lightbulb, Plus, Search, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { flattenPublicPosts, usePublicPosts } from '@/lib/client/hooks/use-portal-posts-query'
import { useSessionContext } from '@/lib/client/hooks/use-root-context'
import { m } from '../../../paraglide/messages.js'
import { Page } from '../../../components/page'
import { IdeaCard } from '../../../components/ideas/idea-card'
import { NewIdeaWizard } from '../../../components/ideas/new-idea-wizard'
import { Appear } from '../../../components/appear'
import { IconButton } from '../../../components/icon-button'
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
  const filterGroups: FilterGroupData[] = useMemo(
    () => [
      {
        id: 'status',
        key: 'status',
        label: m.ideas_status(),
        // by slug: Quackback's list hook takes `status_…` ids or slugs, and status ids are
        // `post_status_…`, so an id would be read as a slug and match nothing
        options: statuses.map((s) => ({
          id: s.slug,
          label: s.name,
          color: s.color ?? null,
          checked: search.status?.includes(s.slug) ?? false,
        })),
      },
      ...tagGroups.map((group) => ({
        id: `tag:${group.kind ?? '-'}`,
        key: 'tag' as const,
        label: group.kind ? capitalize(group.kind) : m.ideas_tags(),
        options: group.tags.map((t) => ({
          id: t.id,
          label: t.value,
          checked: search.tag?.includes(t.id) ?? false,
        })),
      })),
    ],
    [statuses, tagGroups, search.status, search.tag]
  )
  const chips = filterGroups.flatMap((group) =>
    group.options
      .filter((o) => o.checked)
      .map((o) => ({ ...o, key: group.key, group: group.label }))
  )
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

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            variant="ghost"
            aria-label={m.ideas_sort()}
            value={[search.sort ?? 'top']}
            onValueChange={(value) => {
              const next = value[0] as (typeof IDEA_SORTS)[number] | undefined
              if (next) setSearch({ sort: next })
            }}
            items={IDEA_SORTS.map((s) => ({ value: s, label: SORT_LABEL[s]() }))}
          />
          <SearchBox value={search.q ?? ''} onChange={(q) => setSearch({ q })} />
          <FilterMenu
            groups={filterGroups}
            active={activeFilters}
            onToggle={toggle}
            onClear={() => setSearch({ status: [], tag: [] })}
          />
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label={m.ideas_filters()}>
            {chips.map((chip) => (
              <Chip
                key={`${chip.key}:${chip.id}`}
                variant="neutral"
                className="h-7 gap-1.5 ps-2.5 pe-1"
              >
                {chip.color !== undefined && <Dot color={chip.color} />}
                <span className="text-muted">{chip.group}:</span>
                <span className="text-foreground">{chip.label}</span>
                <button
                  type="button"
                  aria-label={m.ideas_filter_remove({ name: `${chip.group}: ${chip.label}` })}
                  className="flex size-5 cursor-pointer items-center justify-center rounded-full text-muted outline-none hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => toggle(chip.key, chip.id, false)}
                >
                  <X className="size-3" />
                </button>
              </Chip>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setSearch({ status: [], tag: [] })}>
              {m.ideas_clear_all()}
            </Button>
          </div>
        )}
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
        <Appear className={cn('flex flex-col gap-4', posts.isFetching && 'opacity-80')}>
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

interface FilterGroupData {
  id: string
  key: 'status' | 'tag'
  label: string
  /** `color` is set for statuses (a dot in the status colour). */
  options: { id: string; label: string; color?: string | null; checked: boolean }[]
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Above this many values a group gets its own search field. */
const SEARCH_FROM = 7

function Dot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full"
      style={{ background: color ?? 'currentColor' }}
    />
  )
}

/**
 * The filters (#34): an icon button with the count, opening one collapsible section per group
 * (only Status open at first; a group with a selection opens too), status values with their colour
 * dot, a search field in long groups.
 */
function FilterMenu({
  groups,
  active,
  onToggle,
  onClear,
}: {
  groups: FilterGroupData[]
  active: number
  onToggle: (key: 'status' | 'tag', id: string, on: boolean) => void
  onClear: () => void
}) {
  const label = active > 0 ? m.ideas_filters_active({ count: active }) : m.ideas_filters()
  return (
    <Popover.Root>
      <Popover.Trigger
        render={
          <IconButton label={label} variant="outline" badge={active || undefined}>
            <Filter />
          </IconButton>
        }
      />
      <Popover.Content
        align="end"
        className="flex max-h-[min(70vh,36rem)] w-80 flex-col overflow-y-auto p-2"
      >
        <Popover.Title className="px-2.5 pt-1.5 pb-2 text-sm font-semibold">
          {m.ideas_filters()}
        </Popover.Title>
        <div className="flex flex-col gap-1">
          {groups
            .filter((g) => g.options.length > 0)
            .map((group) => (
              <FilterSection
                key={group.id}
                group={group}
                defaultOpen={group.key === 'status' || group.options.some((o) => o.checked)}
                onToggle={onToggle}
              />
            ))}
        </div>
        {active > 0 && (
          <div className="mt-2 border-t border-border px-1 pt-2">
            <Button variant="ghost" size="sm" className="w-full" onClick={onClear}>
              {m.ideas_clear_all()}
            </Button>
          </div>
        )}
      </Popover.Content>
    </Popover.Root>
  )
}

function FilterSection({
  group,
  defaultOpen,
  onToggle,
}: {
  group: FilterGroupData
  defaultOpen: boolean
  onToggle: (key: 'status' | 'tag', id: string, on: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const picked = group.options.filter((o) => o.checked).length
  const shown = query
    ? group.options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : group.options
  return (
    <Collapsible.Root defaultOpen={defaultOpen}>
      <Collapsible.Trigger className="w-full">
        <span className="me-auto">{group.label}</span>
        {picked > 0 && (
          <span className="rounded-full bg-accent-soft px-1.5 text-xs text-accent-soft-foreground tabular-nums">
            {picked}
          </span>
        )}
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <div className="flex flex-col gap-2.5 px-2.5 pt-1.5 pb-3 ps-8">
          {group.options.length >= SEARCH_FROM && (
            <div className="relative">
              <Search className="pointer-events-none absolute start-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
              <Input
                size="sm"
                type="search"
                aria-label={`${group.label}: ${m.ideas_filter_search()}`}
                placeholder={m.ideas_filter_search()}
                className="ps-8"
                value={query}
                onChange={(e) => setQuery(e.currentTarget.value)}
              />
            </div>
          )}
          {shown.map((option) => (
            <Checkbox
              key={option.id}
              label={
                <span className="inline-flex items-center gap-2">
                  {option.color !== undefined && <Dot color={option.color} />}
                  {option.label}
                </span>
              }
              checked={option.checked}
              onCheckedChange={(on) => onToggle(group.key, option.id, on)}
            />
          ))}
          {shown.length === 0 && <p className="text-xs text-muted">{m.ideas_filter_nothing()}</p>}
        </div>
      </Collapsible.Panel>
    </Collapsible.Root>
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
    <div className="relative ms-auto w-full max-w-72">
      <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
      <Input
        type="search"
        aria-label={m.ideas_search()}
        placeholder={m.ideas_search()}
        className="ps-9"
        value={draft}
        onChange={(e) => setDraft(e.currentTarget.value)}
      />
    </div>
  )
}
