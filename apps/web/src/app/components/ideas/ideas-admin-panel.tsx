/**
 * Quick admin actions on a project's ideas list (owner's note, #45), for people who manage projects
 * (`projects.manage`): the project's boards (open one, add a new one) and the way to the project
 * editor. Shown in the page's right column (`SidePanel`).
 */
import { Button } from '@crazy-staff/ui'
import { Link } from '@tanstack/react-router'
import { Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { HubProject } from '../../lib/projects'
import { NewBoardDialog } from '../admin/new-board-dialog'
import { SidePanelSection } from '../side-panel'

export function IdeasAdminPanelContent({
  project,
  currentBoard,
  onPickBoard,
}: {
  project: HubProject
  currentBoard?: string
  onPickBoard: (slug: string) => void
}) {
  const [creating, setCreating] = useState(false)
  return (
    <>
      <SidePanelSection label={m.project_boards()}>
        <ul className="flex flex-col gap-0.5">
          {project.boards.map((board) => (
            <li key={board.id}>
              <button
                type="button"
                onClick={() => onPickBoard(board.slug)}
                aria-current={board.slug === currentBoard || undefined}
                className="squircle flex w-full cursor-pointer items-center justify-between gap-2 rounded-control-sm px-2.5 py-1.5 text-start text-sm outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-accent-soft aria-[current]:text-accent-soft-foreground"
              >
                <span className="truncate">{board.name}</span>
                <span className="shrink-0 text-xs text-muted">/{board.slug}</span>
              </button>
            </li>
          ))}
        </ul>
        <Button variant="outline" size="sm" className="w-full" onClick={() => setCreating(true)}>
          <Plus /> {m.project_new_board()}
        </Button>
      </SidePanelSection>
      <Button
        variant="ghost"
        size="sm"
        className="w-full"
        render={<Link to="/admin/projects/$projectId" params={{ projectId: project.id }} />}
      >
        <Settings2 /> {m.ideas_project_settings()}
      </Button>
      {creating && <NewBoardDialog projectId={project.id} onClose={() => setCreating(false)} />}
    </>
  )
}
