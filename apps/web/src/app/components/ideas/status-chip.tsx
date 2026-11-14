import { Chip } from '@crazy-staff/ui'

/** A post status: its name with a dot in the status colour (set by the team in the admin). */
export function StatusChip({ name, color }: { name: string; color?: string | null }) {
  return (
    <Chip size="sm" variant="outline" className="gap-1.5">
      <span
        aria-hidden
        className="size-2 rounded-full"
        style={{ background: color ?? 'currentColor' }}
      />
      {name}
    </Chip>
  )
}
