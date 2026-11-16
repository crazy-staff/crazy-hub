/**
 * Menus and popovers that become drawers on a phone (owner's note, round 7: whatever is small and
 * opens goes into a drawer from the bottom, under the thumb, with rows large enough for a finger).
 * On larger screens they stay crazy-ui's dropdown menu and popover.
 */
import { DropdownMenu, Drawer, Popover, cn } from '@crazy-staff/ui'
import { Check } from 'lucide-react'
import {
  cloneElement,
  Fragment,
  useState,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { usePhone } from '../lib/use-phone'

export interface MenuEntry {
  label: ReactNode
  icon?: ReactNode
  onSelect?: () => void
  /** A router link (or other element) the row renders as, e.g. `<Link to="/settings" />`. */
  render?: ReactElement
  danger?: boolean
  /** Shown with a check (a picked option). */
  checked?: boolean
  /** A line above this entry. */
  separated?: boolean
  lang?: string
}

/** A drawer row: as tall as a finger, icon, label, a check when picked. */
const ROW = cn(
  'squircle flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-control px-3.5 text-start text-base outline-none',
  'transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring',
  '[&_svg]:size-5 [&_svg]:shrink-0'
)

function DrawerRows({ entries, onDone }: { entries: MenuEntry[]; onDone: () => void }) {
  return (
    <div className="flex flex-col gap-1 pb-4">
      {entries.map((entry, i) => {
        const className = cn(
          ROW,
          entry.danger && 'text-danger',
          entry.checked && 'bg-accent-soft text-accent-soft-foreground'
        )
        const content = (
          <>
            {entry.icon && (
              <span className={cn('flex', !entry.danger && !entry.checked && 'text-muted')}>
                {entry.icon}
              </span>
            )}
            <span className="flex-1">{entry.label}</span>
            {entry.checked && <Check className="size-4!" />}
          </>
        )
        const onClick = () => {
          entry.onSelect?.()
          onDone()
        }
        return (
          <Fragment key={i}>
            {entry.separated && <div className="my-1 h-px bg-border" />}
            {entry.render ? (
              cloneElement(entry.render as ReactElement<Record<string, unknown>>, {
                className,
                onClick,
                lang: entry.lang,
                children: content,
              })
            ) : (
              <button
                type="button"
                className={className}
                onClick={onClick}
                lang={entry.lang}
                aria-pressed={entry.checked}
              >
                {content}
              </button>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

/** The trigger with a click that opens the drawer instead of the menu. */
function withOpen(trigger: ReactElement, open: () => void) {
  const props = trigger.props as { onClick?: (e: MouseEvent) => void }
  return cloneElement(trigger as ReactElement<Record<string, unknown>>, {
    onClick: (e: MouseEvent) => {
      props.onClick?.(e)
      open()
    },
  })
}

/** A dropdown menu on larger screens, a drawer of large rows on a phone. */
export function AdaptiveMenu({
  trigger,
  title,
  header,
  entries,
  align = 'end',
  labelled,
  className,
}: {
  trigger: ReactElement
  /** The drawer's title (and the menu's label for screen readers). */
  title: string
  /** Also show the title at the top of the dropdown, with room under it. */
  labelled?: boolean
  /** Shown above the entries (e.g. who is signed in). */
  header?: ReactNode
  entries: MenuEntry[]
  align?: 'start' | 'end'
  className?: string
}) {
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  if (phone) {
    return (
      <>
        {withOpen(trigger, () => setOpen(true))}
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Content>
            <Drawer.Title>{title}</Drawer.Title>
            <Drawer.Body>
              {header && <div className="pb-3">{header}</div>}
              <DrawerRows entries={entries} onDone={() => setOpen(false)} />
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      </>
    )
  }
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={trigger} />
      <DropdownMenu.Content align={align} aria-label={title} className={cn('min-w-48', className)}>
        {labelled && (
          <div className="px-2.5 pt-1.5 pb-2 text-xs font-medium text-muted">{title}</div>
        )}
        {header}
        {entries.map((entry, i) => (
          <Fragment key={i}>
            {entry.separated && <DropdownMenu.Separator />}
            <DropdownMenu.Item
              danger={entry.danger}
              render={entry.render}
              lang={entry.lang}
              onClick={entry.onSelect}
              className={cn(entry.checked && 'bg-accent-soft/60 text-accent-soft-foreground')}
            >
              {entry.icon}
              <span className="flex-1">{entry.label}</span>
              {entry.checked && <Check className="size-3.5! stroke-[2.5]" />}
            </DropdownMenu.Item>
          </Fragment>
        ))}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}

/** A popover on larger screens, a drawer on a phone; `children` is the same content in both. */
export function AdaptivePopover({
  trigger,
  title,
  children,
  className,
  align = 'end',
}: {
  trigger: ReactElement
  title: string
  children: ReactNode
  /** Classes of the popover (the drawer takes the full width). */
  className?: string
  align?: 'start' | 'end'
}) {
  const phone = usePhone()
  const [open, setOpen] = useState(false)
  if (phone) {
    return (
      <>
        {withOpen(trigger, () => setOpen(true))}
        <Drawer.Root open={open} onOpenChange={setOpen}>
          <Drawer.Content>
            <Drawer.Title>{title}</Drawer.Title>
            <Drawer.Body className="pb-6">{children}</Drawer.Body>
          </Drawer.Content>
        </Drawer.Root>
      </>
    )
  }
  return (
    <Popover.Root>
      <Popover.Trigger render={trigger} />
      <Popover.Content align={align} className={className}>
        <Popover.Title className="px-2.5 pt-1.5 pb-2 text-sm font-semibold">{title}</Popover.Title>
        {children}
      </Popover.Content>
    </Popover.Root>
  )
}
