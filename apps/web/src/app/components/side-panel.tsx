/**
 * The right-hand panel of a page for people who can manage it (owner's note, #45): moderation on an
 * idea, quick admin actions on the ideas list, … It adds to the page's own controls, never replaces
 * them. It sits in the page's right column (`PageFrame`'s `toc`) and can be hidden (remembered per
 * panel in this browser); hidden, a small button in the same place brings it back. Where the right
 * column folds away (narrow panel, `useWideLayout` false), `SidePanelInline` shows the content
 * folded at the top of the page instead; it is rendered in one place only.
 */
import { Collapsible, cn } from '@crazy-staff/ui'
import { PanelRightClose, PanelRightOpen, type LucideIcon } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { m } from '../paraglide/messages.js'
import { IconButton } from './icon-button'

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

/** Hidden or shown, remembered in this browser per panel (storage may be unavailable). */
function usePanelHidden(id: string) {
  const key = `crazy-hub:side-panel:${id}`
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === 'hidden')
    } catch {
      // no storage: always shown
    }
  }, [key])
  const set = (next: boolean) => {
    setHidden(next)
    try {
      if (next) localStorage.setItem(key, 'hidden')
      else localStorage.removeItem(key)
    } catch {
      // no storage: only for this page view
    }
  }
  return [hidden, set] as const
}

export function SidePanel({
  id,
  title,
  children,
  className,
}: {
  /** Names the panel for remembering whether it is hidden. */
  id: string
  title: string
  children: ReactNode
  className?: string
}) {
  const [hidden, setHidden] = usePanelHidden(id)
  if (hidden) {
    return (
      <div className="flex justify-end">
        <IconButton
          label={m.panel_show({ title })}
          variant="outline"
          onClick={() => setHidden(false)}
        >
          <PanelRightOpen />
        </IconButton>
      </div>
    )
  }
  return (
    <section
      aria-label={title}
      className={cn(
        // a bit wider than the column's text start: the right column has room to spare
        'squircle -ms-8 flex w-[calc(100%+2rem)] flex-col gap-5 rounded-card border border-border bg-surface p-5',
        className
      )}
    >
      <header className="-mt-1 -me-1 flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        <IconButton label={m.panel_hide()} size="icon-sm" onClick={() => setHidden(true)}>
          <PanelRightClose />
        </IconButton>
      </header>
      {children}
    </section>
  )
}

/**
 * One block of a side panel: an icon and a one-word name, optional icon actions on the right, then
 * the content. Few words, so the panel reads at a glance.
 */
export function SidePanelSection({
  label,
  icon: Icon,
  actions,
  children,
  className,
}: {
  label: string
  icon: LucideIcon
  actions?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-col gap-2.5 border-t border-border pt-4', className)}
    >
      <div className="flex min-h-7 items-center gap-2">
        <span className="flex items-center gap-2 text-xs font-medium text-muted">
          <Icon className="size-4" />
          {label}
        </span>
        {actions && <span className="ms-auto flex items-center gap-1">{actions}</span>}
      </div>
      {children}
    </div>
  )
}

/** The panel's content at the top of the page, folded, for when the right column is hidden. */
export function SidePanelInline({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Collapsible.Root className="squircle rounded-card border border-border bg-surface">
      <Collapsible.Trigger className="w-full justify-start px-4 py-3">{title}</Collapsible.Trigger>
      <Collapsible.Panel>
        <div className="flex flex-col gap-5 px-4 pb-4">{children}</div>
      </Collapsible.Panel>
    </Collapsible.Root>
  )
}
