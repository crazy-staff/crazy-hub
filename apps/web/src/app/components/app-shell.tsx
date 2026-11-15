/**
 * The frame of every portal page, as in the crazy-ui docs: the sidebar on the frame colour (fully
 * collapsible, one gliding hover block over the rows, the active row with the soft accent fill) and the
 * page in a rounded panel. Top right of the panel: language, theme and the account menu. The panel
 * scrolls on its own, with a progressive blur at the bottom while there is more to see and at the top
 * once scrolled.
 *
 * Portal sidebar: the project switcher in the title row, then Home and the picked project's sections in
 * one group (decision 13), and the hub's name and version sticky at the bottom (links like terms,
 * contact and GitHub join it later). The admin has its own sidebar.
 *
 * Until `@crazy-staff/ui` 0.2.1 (crazy-staff/crazy-ui#3) the header row, the collapse button and the
 * row/group spacing are set here to the docs sidebar's values; afterwards the library's own parts match.
 */
import { ProgressiveBlur, Sidebar, cn, useSidebar } from '@crazy-staff/ui'
import { Link, useLocation } from '@tanstack/react-router'
import {
  ArrowLeft,
  FolderKanban,
  LayoutDashboard,
  PanelLeft,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { m } from '../paraglide/messages.js'
import { COMMON, navItemOf, sectionPath } from '../lib/nav'
import { SECTION_META, locate, useProjects } from '../lib/projects'
import { AccountMenu } from './account-menu'
import { AuthDialog } from './auth/auth-dialog'
import { LanguageMenu } from './language-menu'
import { ProjectPicker } from './project-picker'
import { ThemeToggle } from './theme-toggle'
import { HUB_VERSION } from '../lib/version'

/** `admin` swaps the portal sidebar for the admin's own. */
export function AppShell({
  children,
  variant = 'portal',
}: {
  children: ReactNode
  variant?: 'portal' | 'admin'
}) {
  return (
    <Sidebar.Provider className="h-svh min-h-0 overflow-hidden" width="17rem">
      {variant === 'admin' ? <AdminSidebar /> : <AppSidebar />}
      <Sidebar.Inset data-panel-container="" className="@container isolate min-h-0 overflow-hidden">
        {/* the accent glow, top left of every page */}
        <div
          aria-hidden
          className="glow pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem]"
        />
        <TopBar />
        <PanelScroller>{children}</PanelScroller>
      </Sidebar.Inset>
      {/* opens on ?auth=signin|signup from any page */}
      <AuthDialog />
    </Sidebar.Provider>
  )
}

/** The docs sidebar's collapse button: 32px, 16px icon, the neutral hover of the rows, no press scale. */
const iconButton = cn(
  'squircle inline-flex size-8 shrink-0 items-center justify-center rounded-control-sm text-muted outline-none',
  'transition-colors duration-[var(--cui-duration-fast)] ease-ui hover:bg-hover hover:text-foreground',
  'focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4'
)

function CollapseButton({ className }: { className?: string }) {
  const { open, toggle } = useSidebar()
  const label = open ? m.sidebar_collapse() : m.sidebar_open()
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={toggle}
      className={cn(iconButton, className)}
    >
      <PanelLeft />
    </button>
  )
}

/** One nav row: a router link with its icon, active by the nav position. */
function Row({
  to,
  icon: Icon,
  label,
  active,
}: {
  to: string
  icon: LucideIcon
  label: string
  active: boolean
}) {
  return (
    <Sidebar.Item render={<Link to={to} />} icon={<Icon />} active={active}>
      {label}
    </Sidebar.Item>
  )
}

/** The docs sidebar's title row (56px); it keeps its own hover, the gliding block is for the rows. */
function TitleRow({ children }: { children: ReactNode }) {
  return (
    <div data-no-glide-area="" className="my-2 flex h-14 shrink-0 items-center gap-2 ps-4 pe-3">
      {children}
      <CollapseButton />
    </div>
  )
}

/** Sticky at the bottom: the hub's name and version (Quackback's version on hover). */
function HubFooter() {
  return (
    <Sidebar.Footer
      data-no-glide-area=""
      className="flex flex-row items-center justify-start gap-2 border-t border-border px-4 py-3 text-xs text-muted"
    >
      <span className="font-semibold text-foreground">crazy-hub</span>
      <span title={`Quackback ${__APP_VERSION__}`} className="tabular-nums">
        v{HUB_VERSION}
      </span>
    </Sidebar.Footer>
  )
}

/** The portal: the project switcher on top, then Home and the project's sections in one group. */
function AppSidebar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const projects = useProjects()
  const active = navItemOf(projects, pathname)
  const here = locate(projects, pathname)
  // outside a project (the start page, settings) the first project is shown
  const project = here.project ?? projects[0]
  return (
    <Sidebar label={m.nav_label()}>
      <TitleRow>
        {project ? (
          <ProjectPicker projects={projects} project={project} section={here.section} />
        ) : (
          <span className="me-auto truncate text-[0.9375rem] font-semibold">crazy-hub</span>
        )}
      </TitleRow>
      <Sidebar.Content className="gap-6 pt-4 pb-8">
        <Sidebar.Group aria-label={project?.name ?? 'crazy-hub'} classNames={{ list: 'gap-0' }}>
          {COMMON.map((item) => (
            <Row
              key={item.to}
              to={item.to}
              icon={item.icon}
              label={item.label()}
              active={active === item.to}
            />
          ))}
          {project?.sections.map((section) => {
            const meta = SECTION_META[section]
            const to = sectionPath(project, section)
            return (
              <Row
                key={section}
                to={to}
                icon={meta.icon}
                label={meta.label()}
                active={active === to}
              />
            )
          })}
        </Sidebar.Group>
      </Sidebar.Content>
      <HubFooter />
    </Sidebar>
  )
}

/**
 * The admin has its own sidebar (owner's note of 2026-11-14: it will hold many options). Groups grow
 * with each admin issue; rows for screens not built yet are left out.
 */
const ADMIN_GROUPS: {
  label: () => string
  rows: { to: string; icon: LucideIcon; label: () => string }[]
}[] = [
  {
    label: m.admin_group_overview,
    rows: [{ to: '/admin', icon: LayoutDashboard, label: m.admin_overview }],
  },
  {
    label: m.admin_group_hub,
    rows: [
      { to: '/admin/projects', icon: FolderKanban, label: m.admin_projects },
      { to: '/admin/roles', icon: ShieldCheck, label: m.admin_roles },
    ],
  },
]

function AdminSidebar() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const isActive = (to: string) =>
    to === '/admin' ? pathname === '/admin' || pathname === '/admin/' : pathname.startsWith(to)
  return (
    <Sidebar label={m.admin_nav_label()}>
      <TitleRow>
        <span className="me-auto flex min-w-0 items-center gap-2.5">
          <span className="squircle flex size-7 shrink-0 items-center justify-center rounded-chip bg-accent text-accent-foreground [&_svg]:size-3.5">
            <ShieldCheck />
          </span>
          <span className="truncate text-[0.9375rem] font-semibold">{m.nav_admin()}</span>
        </span>
      </TitleRow>
      <Sidebar.Content className="gap-6 pt-4 pb-8">
        <Sidebar.Group aria-label="crazy-hub" classNames={{ list: 'gap-0' }}>
          <Row to="/" icon={ArrowLeft} label={m.admin_back_to_hub()} active={false} />
        </Sidebar.Group>
        {ADMIN_GROUPS.map((group) => (
          <Sidebar.Group key={group.label()} label={group.label()} classNames={{ list: 'gap-0' }}>
            {group.rows.map((row) => (
              <Row
                key={row.to}
                to={row.to}
                icon={row.icon}
                label={row.label()}
                active={isActive(row.to)}
              />
            ))}
          </Sidebar.Group>
        ))}
      </Sidebar.Content>
      <HubFooter />
    </Sidebar>
  )
}

/**
 * Floats over the page (the glow runs under it), the docs' top bar: 56px, 24px in from the left, 16px
 * from the right. The open button shows only while the sidebar is closed.
 */
function TopBar() {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex h-14 items-center gap-1.5 ps-6 pe-4">
      <div className="pointer-events-auto flex items-center">
        <CollapseButton className="-ms-2 in-data-[sidebar=open]:md:hidden" />
      </div>
      <div className="pointer-events-auto ms-auto flex items-center gap-1.5">
        <LanguageMenu />
        <ThemeToggle />
        <AccountMenu />
      </div>
    </header>
  )
}

function PanelScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [more, setMore] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const pathname = useLocation({ select: (l) => l.pathname })

  useEffect(() => {
    const scroller = ref.current
    if (!scroller) return
    const update = () => {
      setMore(scroller.scrollTop + scroller.clientHeight < scroller.scrollHeight - 8)
      setScrolled(scroller.scrollTop > 8)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(scroller)
    if (scroller.firstElementChild) ro.observe(scroller.firstElementChild)
    scroller.addEventListener('scroll', update, { passive: true })
    return () => {
      ro.disconnect()
      scroller.removeEventListener('scroll', update)
    }
  }, [])

  // a new page starts at its top (unless the URL points at a section)
  useEffect(() => {
    if (!location.hash) ref.current?.scrollTo({ top: 0 })
  }, [pathname])

  const edge =
    'pointer-events-none absolute inset-x-0 transition-opacity duration-[var(--cui-duration-normal)]'
  return (
    <>
      <div
        ref={ref}
        data-panel-scroller=""
        className={cn(
          'relative min-h-0 flex-1 overflow-y-auto overscroll-contain [overflow-anchor:none] [scrollbar-gutter:stable] [scrollbar-width:thin]',
          // the docs' page geometry (see PageFrame): 760px page + 304px right column, centred together
          '[--page-width:760px] [--toc-width:--spacing(76)] @max-5xl:[--toc-width:0px]',
          // the top bar floats over the page at every width, so the page starts under it (owner's
          // note: on phones the title ran under the bar's buttons)
          'px-4 pt-14 md:px-[max(--spacing(6),calc((100%-var(--page-width)-var(--toc-width))/2))]'
        )}
      >
        <div className="min-h-full">{children}</div>
      </div>
      {/* under the top bar (z-10), so its buttons stay sharp */}
      <div
        aria-hidden
        className={cn(edge, 'top-0 z-[5] h-20', scrolled ? 'opacity-100' : 'opacity-0')}
      >
        <ProgressiveBlur side="top" size="100%" />
      </div>
      <div
        aria-hidden
        className={cn(edge, 'bottom-0 z-20 h-20', more ? 'opacity-100' : 'opacity-0')}
      >
        <ProgressiveBlur side="bottom" size="100%" tint />
      </div>
    </>
  )
}
