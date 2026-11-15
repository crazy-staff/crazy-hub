/**
 * The top of the portal sidebar (decision 13, owner's note of 2026-11-14): the project switcher takes the
 * title row, so the hub's name doesn't use a row of its own (it sits at the bottom of the sidebar with
 * the version). The row shows the project's badge and name; it opens a menu with every project and its
 * description, the picked one with the soft accent fill of an active row (no radio dot). Switching
 * keeps the open section when the next project has it.
 */
import { DropdownMenu, cn } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import { ChevronsUpDown } from 'lucide-react'
import { m } from '../paraglide/messages.js'
import type { HubProject, SectionId } from '../lib/projects'

function Badge({ project, solid }: { project: HubProject; solid?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'squircle flex size-7 shrink-0 items-center justify-center rounded-chip text-[0.6875rem] font-bold',
        solid ? 'bg-accent text-accent-foreground' : 'bg-accent-soft text-accent-soft-foreground'
      )}
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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`${label}: ${project.name}`}
        className={cn(
          'squircle -ms-2 me-auto flex h-11 min-w-0 flex-1 items-center gap-2.5 rounded-control-sm ps-2 pe-2 text-start outline-none',
          'transition-colors duration-[var(--cui-duration-fast)] ease-ui hover:bg-hover data-popup-open:bg-hover',
          'focus-visible:ring-2 focus-visible:ring-ring'
        )}
      >
        <Badge project={project} solid />
        <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold">
          {project.name}
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" className="w-[max(var(--anchor-width),17rem)]">
        <DropdownMenu.Group>
          <DropdownMenu.GroupLabel className="pb-2.5">{label}</DropdownMenu.GroupLabel>
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
                    className={cn('truncate font-medium', picked && 'text-accent-soft-foreground')}
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
  )
}
