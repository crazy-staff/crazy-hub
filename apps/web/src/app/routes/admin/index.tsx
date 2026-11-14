import { Card, Chip, Reveal } from '@crazy-staff/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { FolderKanban, Inbox, ShieldCheck, type LucideIcon } from 'lucide-react'
import { m } from '../../paraglide/messages.js'
import { Page } from '../../components/page'

const SECTIONS: {
  to?: '/admin/projects' | '/admin/roles'
  icon: LucideIcon
  title: () => string
  description: () => string
}[] = [
  {
    to: '/admin/projects',
    icon: FolderKanban,
    title: m.admin_projects,
    description: m.admin_projects_description,
  },
  {
    to: '/admin/roles',
    icon: ShieldCheck,
    title: m.admin_roles,
    description: m.admin_roles_description,
  },
  { icon: Inbox, title: m.admin_inbox, description: m.admin_inbox_description },
]

/** The admin's start: a card per part of the admin, as the hub's start page does per project. */
export const Route = createFileRoute('/admin/')({
  head: () => ({ meta: [{ title: `${m.nav_admin()} · crazy-hub` }] }),
  component: () => (
    <Page title={m.nav_admin()} description={m.page_admin_description()}>
      <Reveal.Group className="grid gap-3 sm:grid-cols-2" stagger={0.04}>
        {SECTIONS.map((section) => {
          const card = (
            <Card.Root interactive={!!section.to} className="flex h-full gap-3 p-4">
              <span className="squircle flex size-9 shrink-0 items-center justify-center rounded-control-sm bg-accent-soft text-accent-soft-foreground [&_svg]:size-4">
                <section.icon />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {section.title()}
                  {!section.to && (
                    <Chip size="sm" variant="neutral">
                      {m.admin_soon()}
                    </Chip>
                  )}
                </span>
                <span className="mt-1 text-sm text-muted">{section.description()}</span>
              </span>
            </Card.Root>
          )
          return (
            <Reveal.Item key={section.title()}>
              {section.to ? (
                <Link
                  to={section.to}
                  className="block h-full rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {card}
                </Link>
              ) : (
                card
              )}
            </Reveal.Item>
          )
        })}
      </Reveal.Group>
    </Page>
  ),
})
