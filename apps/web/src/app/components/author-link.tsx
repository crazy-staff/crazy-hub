/**
 * A person's name that opens their profile (`/u/$principalId`, owner's note round 4). Without a
 * principal (deleted account, anonymous) it is plain text. `relative z-10` lets it sit inside a card
 * whose whole surface is another link.
 */
import { cn } from '@crazy-staff/ui'
import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'

export function AuthorLink({
  principalId,
  children,
  className,
}: {
  principalId: string | null | undefined
  children: ReactNode
  className?: string
}) {
  if (!principalId) return <span className={className}>{children}</span>
  return (
    <Link
      to="/u/$principalId"
      params={{ principalId }}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'relative z-10 rounded-sm underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {children}
    </Link>
  )
}
