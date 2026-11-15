import { Button, Dialog } from '@crazy-staff/ui'
import { useState, type FormEvent, type ReactNode } from 'react'
import { m } from '../paraglide/messages.js'
import { errorMessage } from '../lib/admin'

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
