/**
 * The people list of an @-mention being typed (#5). It opens inside the editor, right under the text,
 * on every screen size: a drawer or a floating popup would cover the text (and on phones close the
 * keyboard) while the person is still typing. Arrow keys move, Enter or Tab picks, Escape closes;
 * the text field keeps the focus (combobox pattern, `aria-activedescendant`).
 *
 * People come from Quackback's `/api/v1/mentions/suggest` (signed-in people only, name prefix match,
 * never e-mail, rate-limited).
 */
import { Avatar, Spinner, cn } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { m } from '../../paraglide/messages.js'
import { useDebouncedValue } from '../../lib/use-debounced'

export interface MentionPerson {
  principalId: string
  displayName: string | null
  avatarUrl: string | null
}

async function suggest(query: string): Promise<MentionPerson[]> {
  const response = await fetch(`/api/v1/mentions/suggest?${new URLSearchParams({ q: query })}`, {
    credentials: 'include',
  })
  if (!response.ok) return []
  const people = (await response.json()) as MentionPerson[]
  return people.filter((p) => p.displayName)
}

/** The people matching `query` (debounced); empty while closed. */
export function useMentionPeople(query: string | null) {
  const settled = useDebouncedValue(query, 150)
  const result = useQuery({
    queryKey: ['crazy', 'mention-suggest', settled],
    queryFn: () => suggest(settled ?? ''),
    enabled: settled !== null,
    staleTime: 30_000,
  })
  return {
    people: query === null ? [] : (result.data ?? []),
    loading: query !== null && (settled !== query || result.isFetching) && !result.data,
    /** The list matches what is typed now (Enter must not pick from an older list). */
    ready: query !== null && settled === query && !result.isFetching,
  }
}

export function MentionSuggestions({
  id,
  people,
  loading,
  active,
  onHover,
  onPick,
}: {
  /** The listbox id (`aria-controls` of the text field); rows are `${id}-${index}`. */
  id: string
  people: MentionPerson[]
  loading: boolean
  active: number
  onHover: (index: number) => void
  onPick: (person: MentionPerson) => void
}) {
  return (
    <div className="border-t border-border p-1">
      {people.length === 0 ? (
        <p className="flex h-10 items-center gap-2 px-2 text-sm text-muted max-sm:h-12">
          {loading ? <Spinner size="sm" /> : null}
          {loading ? m.mentions_searching() : m.mentions_none()}
        </p>
      ) : (
        <ul id={id} role="listbox" aria-label={m.mentions_people()} className="flex flex-col">
          {people.map((person, index) => (
            <li
              key={person.principalId}
              id={`${id}-${index}`}
              role="option"
              aria-selected={index === active}
              // keep the focus (and the caret) in the text field
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => onHover(index)}
              onClick={() => onPick(person)}
              className={cn(
                'squircle flex h-10 cursor-pointer items-center gap-2.5 rounded-control-sm px-2 text-sm max-sm:h-12',
                index === active ? 'bg-hover text-foreground' : 'text-muted'
              )}
            >
              <Avatar
                size="sm"
                className="size-6"
                classNames={{ fallback: 'text-[0.5625rem]' }}
                src={person.avatarUrl ?? undefined}
                name={person.displayName ?? '?'}
              />
              <span className="truncate font-medium">{person.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
