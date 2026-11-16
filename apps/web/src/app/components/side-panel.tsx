/**
 * The right-hand panel of a page for people who can manage it (owner's note, #45): moderation on an
 * idea, quick admin actions on the ideas list, … It adds to the page's own controls, never replaces
 * them.
 *
 * One icon button among the page's controls opens it, on every screen (owner's note, round 7):
 * - wide (`useWideLayout`): it shows or hides the panel in the page's right column (`PageFrame`'s
 *   `toc`), remembered per panel in this browser; the button looks pressed while the panel is open;
 * - narrow: it opens the same content in a drawer from the bottom, with larger touch targets
 *   (`usePanelTouch`).
 *
 * A page calls `useSidePanel(id)` once and hands the result to `SidePanel` (the column) and
 * `SidePanelButton` (the control).
 */
import { Drawer, cn } from '@crazy-staff/ui'
import { X, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { m } from '../paraglide/messages.js'
import { IconButton } from './icon-button'
import { EASE } from './page'

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

/** Inside the drawer the panel's controls are larger, for a finger. */
const TouchContext = createContext(false)
export const usePanelTouch = () => useContext(TouchContext)

export interface SidePanelState {
  id: string
  /** The right column is there (else the drawer is used). */
  wide: boolean
  /** Shown in the right column (wide screens). */
  open: boolean
  setOpen: (open: boolean) => void
}

/** Open or closed, remembered in this browser per panel (storage may be unavailable). */
export function useSidePanel(id: string): SidePanelState {
  const key = `crazy-hub:side-panel:${id}`
  const wide = useWideLayout()
  const [open, setOpenState] = useState(true)
  useEffect(() => {
    try {
      setOpenState(localStorage.getItem(key) !== 'hidden')
    } catch {
      // no storage: open
    }
  }, [key])
  const setOpen = (next: boolean) => {
    setOpenState(next)
    try {
      if (next) localStorage.removeItem(key)
      else localStorage.setItem(key, 'hidden')
    } catch {
      // no storage: only for this page view
    }
  }
  return { id, wide, open, setOpen }
}

/** The panel in the page's right column; renders nothing on a narrow screen or while closed. */
export function SidePanel({
  panel,
  title,
  children,
  className,
}: {
  panel: SidePanelState
  title: string
  children: ReactNode
  className?: string
}) {
  const reduce = useReducedMotion()
  // opening slides it in from the right with a fade; closing slides it back out
  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, x: 24, filter: 'blur(4px)' },
        animate: { opacity: 1, x: 0, filter: 'blur(0px)' },
        exit: { opacity: 0, x: 24, filter: 'blur(4px)' },
        transition: { duration: 0.28, ease: EASE },
      }
  return (
    <AnimatePresence initial={false}>
      {panel.wide && panel.open && (
        <motion.section
          key="panel"
          aria-label={title}
          className={cn(
            // a bit wider than the column's text start (the right column has room to spare), and
            // pulled up so its header lines up with the page title
            'squircle -ms-8 -mt-5 flex w-[calc(100%+2rem)] flex-col gap-5 rounded-card border border-border bg-surface p-5',
            className
          )}
          {...motionProps}
        >
          <header className="-mt-1 -me-1 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">{title}</h2>
            <IconButton label={m.panel_hide()} size="icon-sm" onClick={() => panel.setOpen(false)}>
              <X />
            </IconButton>
          </header>
          {children}
        </motion.section>
      )}
    </AnimatePresence>
  )
}

/**
 * The control that opens the panel, placed with the page's other icon buttons: on a wide screen it
 * toggles the right column (pressed while open), on a narrow one it opens the drawer.
 */
export function SidePanelButton({
  panel,
  title,
  icon: Icon,
  variant = 'ghost',
  children,
}: {
  panel: SidePanelState
  title: string
  icon: LucideIcon
  variant?: 'ghost' | 'outline'
  /** The panel's content, for the drawer. */
  children: ReactNode
}) {
  const [drawer, setDrawer] = useState(false)
  const pressed = panel.wide && panel.open
  return (
    <>
      <IconButton
        label={title}
        variant={variant}
        aria-pressed={panel.wide ? pressed : undefined}
        className={cn(pressed && 'border-accent/40 bg-accent-soft text-accent-soft-foreground')}
        onClick={() => (panel.wide ? panel.setOpen(!panel.open) : setDrawer(true))}
      >
        <Icon />
      </IconButton>
      {!panel.wide && (
        <Drawer.Root open={drawer} onOpenChange={setDrawer}>
          <Drawer.Content>
            <Drawer.Title>{title}</Drawer.Title>
            <Drawer.Body>
              <TouchContext.Provider value>
                <section
                  aria-label={title}
                  // the title already separates: no line above the first block
                  className="flex flex-col gap-6 pt-2 pb-6 [&>[role=group]:first-child]:border-t-0 [&>[role=group]:first-child]:pt-0"
                >
                  {children}
                </section>
              </TouchContext.Provider>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      )}
    </>
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
  const touch = usePanelTouch()
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'flex flex-col border-t border-border',
        touch ? 'gap-3 pt-5' : 'gap-2.5 pt-4',
        className
      )}
    >
      <div className={cn('flex items-center gap-2', touch ? 'min-h-10' : 'min-h-7')}>
        <span
          className={cn(
            'flex items-center gap-2 font-medium text-muted',
            touch ? 'text-sm' : 'text-xs'
          )}
        >
          <Icon className="size-4" />
          {label}
        </span>
        {actions && <span className="ms-auto flex items-center gap-1">{actions}</span>}
      </div>
      {children}
    </div>
  )
}
