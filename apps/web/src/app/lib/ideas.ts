/**
 * Helpers of the ideas board (#5): tag grouping by `kind: value` (decision 13) and the list's URL state.
 */
export interface TagLike {
  id: string
  name: string
  color?: string | null
}

export interface TagGroup<T extends TagLike> {
  /** `game` for `game: Gothic 1`; null for plain tags. */
  kind: string | null
  tags: (T & { value: string })[]
}

/** Splits `kind: value` tags into one group per kind (in first-seen order); plain tags come last. */
export function groupTags<T extends TagLike>(tags: readonly T[]): TagGroup<T>[] {
  const groups = new Map<string | null, TagGroup<T>>()
  for (const tag of tags) {
    const match = /^([^:]{1,40}):\s*(.+)$/.exec(tag.name)
    const kind = match ? match[1].trim() : null
    const value = match ? match[2].trim() : tag.name
    if (!groups.has(kind)) groups.set(kind, { kind, tags: [] })
    groups.get(kind)!.tags.push({ ...tag, value })
  }
  const plain = groups.get(null)
  groups.delete(null)
  return [...groups.values(), ...(plain ? [plain] : [])]
}

/** The first `max` characters of a post's text on one line, cut at a word. */
export function excerpt(content: string, max = 180): string {
  const flat = content.replace(/\s+/g, ' ').trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 20))}…`
}

export const IDEA_SORTS = ['top', 'new', 'trending'] as const
export type IdeaSort = (typeof IDEA_SORTS)[number]

export interface IdeasSearch {
  board?: string
  sort?: IdeaSort
  q?: string
  status?: string[]
  tag?: string[]
}

const list = (value: unknown) =>
  (Array.isArray(value) ? value : value === undefined ? [] : [value])
    .filter((v): v is string => typeof v === 'string' && v.length > 0 && v.length <= 80)
    .slice(0, 20)

/** The ideas list's search params, cleaned (unknown values dropped). */
export function parseIdeasSearch(raw: Record<string, unknown>): IdeasSearch {
  const sort = IDEA_SORTS.find((s) => s === raw.sort)
  const q = typeof raw.q === 'string' ? raw.q.slice(0, 200) : undefined
  const status = list(raw.status)
  const tag = list(raw.tag)
  return {
    ...(typeof raw.board === 'string' && raw.board ? { board: raw.board } : {}),
    ...(sort && sort !== 'top' ? { sort } : {}),
    ...(q ? { q } : {}),
    ...(status.length ? { status } : {}),
    ...(tag.length ? { tag } : {}),
  }
}
