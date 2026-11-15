/**
 * An icon-only button with its name as `aria-label` and a tooltip (declutter rule, `docs/kickoff.md`):
 * the icon carries the meaning, the tooltip names it for sighted users, the label for screen readers.
 * `badge` puts a count in the corner (e.g. active filters).
 */
import { Button, Tooltip, cn } from '@crazy-staff/ui'
import type { ComponentProps, ReactNode } from 'react'

export function IconButton({
  label,
  badge,
  size = 'icon',
  variant = 'ghost',
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, 'size' | 'aria-label'> & {
  label: string
  badge?: ReactNode
  size?: 'icon' | 'icon-sm'
}) {
  return (
    <Tooltip content={label}>
      <Button
        {...props}
        size={size}
        variant={variant}
        aria-label={label}
        className={cn('relative', className)}
      >
        {children}
        {badge != null && badge !== 0 && <CountBadge>{badge}</CountBadge>}
      </Button>
    </Tooltip>
  )
}

/** A small accent count on the corner of an icon button. */
export function CountBadge({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden
      className="absolute -end-1.5 -top-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] leading-none font-semibold text-accent-foreground tabular-nums ring-2 ring-background"
    >
      {children}
    </span>
  )
}
