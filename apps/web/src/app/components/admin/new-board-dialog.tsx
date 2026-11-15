/** A new board, created and linked to a project at once (project editor, ideas admin panel). */
import { Field, Input, Textarea, toast } from '@crazy-staff/ui'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createProjectBoardFn } from '@/lib/server/crazy/admin-functions'
import { m } from '../../paraglide/messages.js'
import { FormDialog } from '../form-dialog'

export function NewBoardDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string
  onClose: () => void
  onCreated?: (boardId: string) => void
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={m.project_new_board()}
      submitLabel={m.project_new_board()}
      dirty={name !== '' || description !== ''}
      onSubmit={async () => {
        const board = await createProjectBoardFn({ data: { projectId, name, description } })
        onCreated?.(board.id)
        await queryClient.invalidateQueries({ queryKey: ['crazy'] })
        await router.invalidate()
        toast.success(m.project_board_created())
      }}
    >
      <Field label={m.project_board_name()} required>
        <Input
          required
          autoFocus
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.currentTarget.value)}
        />
      </Field>
      <Field label={m.project_board_description()} description={m.wizard_optional()}>
        <Textarea
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e) => setDescription(e.currentTarget.value)}
        />
      </Field>
    </FormDialog>
  )
}
