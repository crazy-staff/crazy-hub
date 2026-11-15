/**
 * The right-hand panel of a page for people who can manage it (owner's note, #45): moderation on an
 * idea, quick admin actions on the ideas list, … It sits in the page's right column (`PageFrame`'s
 * `toc`). Where that column folds away (narrow panel, `useWideLayout` false), `SidePanelInline`
 * shows the same content folded at the top of the page instead; it is rendered in one place only.
 */
import { Collapsible, cn } from '@crazy-staff/ui'
import type { LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * Whether the page's right column is shown: the panel (`data-panel-container`, app-shell.tsx) is at
 * least 64rem wide (the `@5xl` container query of `PageFrame`) and the window at least `md`. True
 * on the server and until measured, so the first render matches.
 */
export function useWideLayout() {
  const [wide, setWide] = useState(true)
  useEffect(() => {
    const el = document.querySelector('[data-panel-container]')
    if (!el) return
    const measure = () =>
      setWide(el.getBoundingClientRect().width >= 1024 && window.innerWidth >= 768)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return wide
}

export function SidePanel({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        // a bit wider than the column's text start: the right column has room to spare
        'squircle -ms-8 flex w-[calc(100%+2rem)] flex-col gap-6 rounded-card border border-border bg-surface p-5',
        className
      )}
    >
      <h2 className="flex items-center gap-2.5 text-base font-semibold">
        <span className="squircle flex size-8 items-center justify-center rounded-control-sm bg-accent-soft text-accent-soft-foreground">
          <Icon className="size-4" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** One labelled block of a side panel. */
export function SidePanelSection({
  label,
  icon: Icon,
  description,
  children,
  className,
}: {
  label: string
  icon?: LucideIcon
  description?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-3 border-t border-border pt-5', className)}>
      <div className="flex flex-col gap-0.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          {Icon && <Icon className="size-4 text-muted" />}
          {label}
        </span>
        {description && <span className="text-xs text-muted">{description}</span>}
      </div>
      {children}
    </div>
  )
}

/** The panel's content at the top of the page, folded, for when the right column is hidden. */
export function SidePanelInline({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <Collapsible.Root className="squircle rounded-card border border-border bg-surface">
      <Collapsible.Trigger className="w-full justify-start px-4 py-3">
        <Icon className="size-4 text-muted" /> {title}
      </Collapsible.Trigger>
      <Collapsible.Panel>
        <div className="flex flex-col gap-5 px-4 pb-4">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
