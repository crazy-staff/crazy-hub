import { Card, Reveal } from '@crazy-staff/ui'
import { createFileRoute, Link } from '@tanstack/react-router'
import { m } from '../../paraglide/messages.js'
import { Page } from '../../components/page'
import { useProjects } from '../../lib/projects'

/** The hub's start page, common to every project: what crazy-hub is and a card per project. */
export const Route = createFileRoute('/_app/')({
  head: () => ({ meta: [{ title: 'crazy-hub' }] }),
  component: Home,
})

function Home() {
  const projects = useProjects()
  return (
    <Page title="crazy-hub" description={m.page_home_description()}>
      {/* link cards as in the crazy-ui docs */}
      <Reveal.Group className="grid gap-3 @3xl:grid-cols-2" stagger={0.04}>
        {projects.map((project) => (
          <Reveal.Item key={project.id}>
            <Link
              to="/$project"
              params={{ project: project.slug }}
              className="block h-full rounded-card outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card.Root interactive className="flex h-full gap-3 p-4">
                <span className="squircle flex size-9 shrink-0 items-center justify-center rounded-control-sm bg-accent-soft text-xs font-semibold text-accent-soft-foreground">
                  {project.short}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-semibold">{project.name}</span>
                  <span className="mt-1 text-sm text-muted">{project.description}</span>
                </span>
              </Card.Root>
            </Link>
          </Reveal.Item>
        ))}
      </Reveal.Group>
    </Page>
  )
}
