/**
 * Quick admin actions on a project's ideas list (owner's note, #45), for people who manage projects
 * (`projects.manage`): the project's boards (open one, add a new one) and the way to the project
 * editor. Shown in the page's right column (`SidePanel`).
 */
import { Link } from '@tanstack/react-router'
import { LayoutList, Plus, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { m } from '../../paraglide/messages.js'
import type { HubProject } from '../../lib/projects'
import { NewBoardDialog } from '../admin/new-board-dialog'
import { SidePanelSection } from '../side-panel'
import { IconButton } from '../icon-button'

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
      <SidePanelSection
        label={m.project_boards()}
        icon={LayoutList}
        actions={
          <>
            <IconButton
              label={m.project_new_board()}
              size="icon-sm"
              onClick={() => setCreating(true)}
            >
              <Plus />
            </IconButton>
            <IconButton
              label={m.ideas_project_settings()}
              size="icon-sm"
              render={<Link to="/admin/projects/$projectId" params={{ projectId: project.id }} />}
            >
              <Settings2 />
            </IconButton>
          </>
        }
      >
        <ul className="flex flex-col gap-0.5">
          {project.boards.map((board) => (
            <li key={board.id}>
              <button
                type="button"
                onClick={() => onPickBoard(board.slug)}
                aria-current={board.slug === currentBoard || undefined}
                className="squircle flex w-full cursor-pointer items-center gap-2 rounded-control-sm px-2.5 py-1.5 text-start text-sm outline-none transition-colors hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring aria-[current]:bg-accent-soft aria-[current]:text-accent-soft-foreground"
              >
                <span className="truncate">{board.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </SidePanelSection>
      {creating && <NewBoardDialog projectId={project.id} onClose={() => setCreating(false)} />}
    </>
  )
}
