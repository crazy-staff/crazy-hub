/**
 * Pick tags, grouped by `kind: value` (category, game, area …; plain tags last). Each tag is a toggle
 * chip; the picked ones have the soft accent fill.
 */
import { cn } from '@crazy-staff/ui'
import { useMemo } from 'react'
import { groupTags, type TagLike } from '../../lib/ideas'
import { m } from '../../paraglide/messages.js'

export function TagPicker({
  tags,
  value,
  onChange,
}: {
  tags: readonly TagLike[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  const groups = useMemo(() => groupTags(tags), [tags])
  if (tags.length === 0) return null
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id])
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group) => (
        <div key={group.kind ?? '-'} className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted capitalize">
            {group.kind ?? m.ideas_tags()}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {group.tags.map((tag) => {
              const on = value.includes(tag.id)
              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(tag.id)}
                  className={cn(
                    'rounded-chip border px-2 py-0.5 text-xs outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                    on
                      ? 'border-accent bg-accent-soft text-accent-soft-foreground'
                      : 'border-border text-muted hover:bg-hover hover:text-foreground'
                  )}
                >
                  {tag.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
