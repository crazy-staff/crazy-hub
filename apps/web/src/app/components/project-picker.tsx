/**
 * The project picker at the top of the sidebar (decision 13): the hub's main division, part of the URL.
 * One row in the style of the docs' search field; it opens a menu with every project and its
 * description. The picked project has the soft accent fill of an active sidebar row (no radio dot).
 * Switching keeps the open section when the next project has it. The docs' game/renderer choice is
 * not here: it lives next to the docs search (#14).
 */
import { DropdownMenu, cn } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown } from 'lucide-react'
import { m } from '../paraglide/messages.js'
import type { HubProject, SectionId } from '../lib/projects'

function Badge({ project }: { project: HubProject }) {
  return (
    <span
      aria-hidden
      className="squircle flex size-7 shrink-0 items-center justify-center rounded-chip bg-accent-soft text-[0.6875rem] font-semibold text-accent-soft-foreground"
    >
      {project.short}
    </span>
  )
}

export function ProjectPicker({
  projects,
  project,
  section,
}: {
  projects: HubProject[]
  project: HubProject
  /** The open section, kept when switching. */
  section?: SectionId
}) {
  const navigate = useNavigate()
  const label = m.context_project()
  return (
    <div
      data-no-glide-area=""
      className="squircle overflow-hidden rounded-item border border-border bg-surface-2/50"
    >
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(
            'flex h-12 w-full items-center gap-2.5 ps-2 pe-2.5 text-start text-sm outline-none',
            'transition-colors duration-[var(--cui-duration-fast)] ease-ui hover:bg-hover data-popup-open:bg-hover',
            'focus-visible:bg-hover'
          )}
        >
          <Badge project={project} />
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <span className="truncate text-[0.6875rem] text-muted">{label}</span>
            <span className="truncate font-medium">{project.name}</span>
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 text-muted" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Content align="start" className="w-[max(var(--anchor-width),17rem)]">
          <DropdownMenu.Group>
            <DropdownMenu.GroupLabel>{label}</DropdownMenu.GroupLabel>
            {projects.map((choice) => {
              const picked = choice.id === project.id
              return (
                <DropdownMenu.Item
                  key={choice.id}
                  aria-current={picked || undefined}
                  onClick={() => {
                    if (picked) return
                    const target = choice.sections.find((s) => s === section) ?? choice.sections[0]
                    void (target
                      ? navigate({
                          to: '/$project/$section',
                          params: { project: choice.slug, section: target },
                        })
                      : navigate({ to: '/$project', params: { project: choice.slug } }))
                  }}
                  className={cn(
                    'items-start py-2',
                    picked && 'bg-accent-soft data-[highlighted]:bg-accent-soft'
                  )}
                >
                  <Badge project={choice} />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      className={cn(
                        'truncate font-medium',
                        picked && 'text-accent-soft-foreground'
                      )}
                    >
                      {choice.name}
                    </span>
                    <span className="truncate text-xs text-muted">{choice.description}</span>
                  </span>
                </DropdownMenu.Item>
              )
            })}
          </DropdownMenu.Group>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </div>
  )
}
