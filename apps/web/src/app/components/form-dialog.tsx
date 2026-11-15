import { AlertDialog, Button, Dialog } from '@crazy-staff/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { m } from '../paraglide/messages.js'
import { errorMessage } from '../lib/admin'

/**
 * Asks before closing a dialog with unsaved changes (owner's note, 2026-11-15: a stray Cancel lost a
 * long idea). `request(close)` closes at once when nothing changed, otherwise shows the question.
 */
export function useDiscardGuard(dirty: boolean) {
  const [pending, setPending] = useState<null | (() => void)>(null)
  const request = (close: () => void) => (dirty ? setPending(() => close) : close())
  const element = (
    <AlertDialog
      open={pending !== null}
      onOpenChange={(open) => {
        if (!open) setPending(null)
      }}
      title={m.discard_title()}
      description={m.discard_text()}
      cancelLabel={m.discard_keep()}
      actionLabel={m.discard_confirm()}
      tone="danger"
      onAction={() => {
        pending?.()
        setPending(null)
      }}
    />
  )
  return { request, element }
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
  size = 'md',
  dirty = false,
  onSubmit,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  submitLabel?: string
  size?: 'sm' | 'md' | 'lg'
  /** Unsaved changes: closing asks first. */
  dirty?: boolean
  onSubmit: (data: FormData) => Promise<void>
  children: ReactNode
}) {
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const guard = useDiscardGuard(dirty && !busy)
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
        if (next) onOpenChange(true)
        else guard.request(() => onOpenChange(false))
      }}
    >
      <Dialog.Content size={size}>
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
            <Button
              variant="ghost"
              type="button"
              onClick={() => guard.request(() => onOpenChange(false))}
            >
              {m.admin_cancel()}
            </Button>
            <Button type="submit" disabled={busy}>
              {submitLabel ?? m.settings_save()}
            </Button>
          </Dialog.Footer>
        </form>
      </Dialog.Content>
      {guard.element}
    </Dialog.Root>
  )
}

export const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim()
