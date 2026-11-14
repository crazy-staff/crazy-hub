/**
 * Small pieces the admin editors share: the two-letter badge, icon buttons for a row (move, edit,
 * delete with a confirmation) and a dialog with a form.
 */
import { AlertDialog, Button, Dialog, cn } from '@crazy-staff/ui'
import { ArrowDown, ArrowUp, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import { m } from '../../paraglide/messages.js'
import { errorMessage } from '../../lib/admin'

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

/**
 * A dialog around a form. `onSubmit` gets the form data; a thrown error shows above the buttons
 * (crazy-hub reason codes become their message), success closes the dialog.
 */
export function FormDialog({
  open,
  onOpenChange,
  title,
  submitLabel,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel?: string
  onSubmit: (data: FormData) => Promise<void>
  children: ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await onSubmit(new FormData(e.currentTarget))
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next) setError(null)
        onOpenChange(next)
      }}
    >
      <Dialog.Content size="md">
        <form onSubmit={submit} className="contents">
          <Dialog.Header>
            <Dialog.Title>{title}</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body className="flex flex-col gap-4">
            {children}
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.Close render={<Button variant="ghost" type="button" />}>
              {m.admin_cancel()}
            </Dialog.Close>
            <Button type="submit" disabled={busy}>
              {submitLabel ?? m.settings_save()}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
    </Dialog.Root>
  )
}

export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
