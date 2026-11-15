/** Tags of an idea: any tag for a moderator, the public tags for the author. */
import { Button, cn } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { Tags } from 'lucide-react'
import { useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { setIdeaTagsFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { FormDialog } from '../form-dialog'
import { useAct } from '../../lib/idea-act'
import { TagPicker } from './tag-picker'

export function TagsDialog({
  postId,
  current,
  moderator,
  className,
}: {
  postId: string
  current: string[]
  moderator?: boolean
  className?: string
}) {
  const act = useAct(postId)
  const tags = useQuery(portalQueries.tags()).data ?? []
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState(current)
  return (
    <>
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
