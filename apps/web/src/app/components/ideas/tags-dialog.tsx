/** Tags of an idea: any tag for a moderator, the public tags for the author. */
import { Button, cn } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Tags } from 'lucide-react'
import { useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { setIdeaTagsFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { FormDialog } from '../form-dialog'
import { IconButton } from '../icon-button'
import { useAct } from '../../lib/idea-act'
import { TagPicker } from './tag-picker'

export function TagsDialog({
  postId,
  current,
  moderator,
  iconOnly,
  className,
}: {
  postId: string
  current: string[]
  moderator?: boolean
  /** An icon button with a tooltip (side panel) instead of a labelled button. */
  iconOnly?: boolean
  className?: string
}) {
  const act = useAct(postId)
  const tags = useQuery(portalQueries.tags()).data ?? []
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current)
  return (
    <>
      {iconOnly ? (
        <IconButton
          label={m.ideas_edit_tags()}
          size="icon-sm"
          className={className}
          onClick={() => {
            setValue(current)
            setOpen(true)
          }}
        >
          <Pencil />
        </IconButton>
      ) : (
        <Button
          variant={moderator ? 'outline' : 'ghost'}
          size="sm"
          className={cn(className)}
          onClick={() => {
            setValue(current)
            setOpen(true)
          }}
        >
          <Tags /> {m.ideas_edit_tags()}
        </Button>
      )}
      {open && (
        <FormDialog
          open
          onOpenChange={setOpen}
          title={m.ideas_edit_tags()}
          onSubmit={async () => {
            await setIdeaTagsFn({ data: { postId, tagIds: value } })
            await act(async () => {})
          }}
        >
          <TagPicker tags={tags} value={value} onChange={setValue} />
        </FormDialog>
      )}
    </>
  )
}
