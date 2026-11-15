/**
 * Small pieces the admin editors share: the two-letter badge, icon buttons for a row (move, edit,
 * delete with a confirmation); the form dialog lives in `../form-dialog`.
 */
import { AlertDialog, Button, cn } from '@crazy-staff/ui'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'

export function Badge({
  text,
  muted,
  className,
}: {
  text: string
  muted?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'squircle flex size-8 shrink-0 items-center justify-center rounded-chip text-xs font-semibold',
        muted ? 'bg-surface-2 text-muted' : 'bg-accent-soft text-accent-soft-foreground',
        className
      )}
    >
      {text || '·'}
    </span>
  )
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick?: () => void
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

/** Up / down / edit / delete for a row; leave a handler out to drop its button. */
export function RowActions({
  first,
  last,
  onMove,
  onEdit,
  onDelete,
  deleteTitle,
  deleteText,
}: {
  first?: boolean
  last?: boolean
  onMove?: (direction: -1 | 1) => void
  onEdit?: () => void
  onDelete?: () => void
  deleteTitle?: string
  deleteText?: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {onMove && (
        <>
          <IconButton label={m.admin_move_up()} disabled={first} onClick={() => onMove(-1)}>
            <ArrowUp />
          </IconButton>
          <IconButton label={m.admin_move_down()} disabled={last} onClick={() => onMove(1)}>
            <ArrowDown />
          </IconButton>
        </>
      )}
      {onEdit && (
        <IconButton label={m.admin_edit()} onClick={onEdit}>
          <Pencil />
        </IconButton>
      )}
      {onDelete && (
        <AlertDialog
          trigger={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={m.admin_delete()}
              title={m.admin_delete()}
              // destructive: always red (owner's rule)
              className="text-danger hover:bg-danger/10 hover:text-danger"
            >
              <Trash2 />
            </Button>
          }
          title={deleteTitle ?? m.admin_delete()}
          description={deleteText}
          cancelLabel={m.admin_cancel()}
          actionLabel={m.admin_delete()}
          tone="danger"
          onAction={onDelete}
        />
      )}
    </div>
  )
}

export { FormDialog, text } from '../form-dialog'
