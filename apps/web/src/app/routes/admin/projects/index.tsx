import { Button, Card, Chip, Field, Input } from '@crazy-staff/ui'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { createProjectFn, moveProjectFn } from '@/lib/server/crazy/admin-functions'
import { m } from '../../../paraglide/messages.js'
import { Page } from '../../../components/page'
import { Badge, FormDialog, text } from '../../../components/admin/parts'
import { SortableList } from '../../../components/admin/sortable'
import { adminQueries, slugify } from '../../../lib/admin'

/** Every project of the hub, in nav order (decision 13). */
export const Route = createFileRoute('/admin/projects/')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQueries.projects()),
  head: () => ({ meta: [{ title: `${m.admin_projects()} · crazy-hub` }] }),
  component: Projects,
})

function Projects() {
  const { data } = useSuspenseQuery(adminQueries.projects())
  const queryClient = useQueryClient()
  const router = useRouter()
  const [creating, setCreating] = useState(false)

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: adminQueries.projects().queryKey })
    await router.invalidate()
  }

  return (
    <Page
      title={m.admin_projects()}
      description={m.admin_projects_description()}
      actions={
        <Button onClick={() => setCreating(true)}>
          <Plus /> {m.project_new()}
        </Button>
      }
    >
      <Card.Root>
        <SortableList
          items={data.projects}
          className="flex flex-col divide-y divide-border"
          onMove={async (id, to) => {
            await moveProjectFn({ data: { id, to } })
            await refresh()
          }}
        >
          {(project, handle) => (
            <div className="flex items-center gap-2 py-3 ps-2 pe-4">
              {handle}
              <Badge text={project.short} muted={project.archived} />
              <Link
                to="/admin/projects/$projectId"
                params={{ projectId: project.id }}
                className="flex min-w-0 flex-1 flex-col rounded-control-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="flex items-center gap-2 font-medium">
                  <span className="truncate">{project.name}</span>
                  {project.archived && (
                    <Chip size="sm" variant="neutral">
                      {m.project_archived()}
                    </Chip>
                  )}
                </span>
                <span className="truncate text-sm text-muted">/{project.slug}</span>
              </Link>
            </div>
          )}
        </SortableList>
      </Card.Root>
      <NewProjectDialog open={creating} onOpenChange={setCreating} onCreated={refresh} />
    </Page>
  )
}

function NewProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [slug, setSlug] = useState('')
  const [touched, setTouched] = useState(false)
  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setSlug('')
          setTouched(false)
        }
        onOpenChange(next)
      }}
      title={m.project_new()}
      submitLabel={m.admin_create()}
      onSubmit={async (form) => {
        const created = await createProjectFn({
          data: {
            name: text(form, 'name'),
            slug: text(form, 'slug'),
            short: text(form, 'short'),
            description: text(form, 'description'),
          },
        })
        await onCreated()
        void navigate({ to: '/admin/projects/$projectId', params: { projectId: created.id } })
      }}
    >
      <Field label={m.admin_name()} required>
        <Input
          name="name"
          required
          maxLength={80}
          autoFocus
          onChange={(e) => {
            if (!touched) setSlug(slugify(e.currentTarget.value))
          }}
        />
      </Field>
      <Field label={m.admin_slug()} description={m.admin_slug_help()} required>
        <Input
          name="slug"
          required
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={48}
          value={slug}
          onChange={(e) => {
            setTouched(true)
            setSlug(e.currentTarget.value)
          }}
        />
      </Field>
      <Field label={m.admin_short()} description={m.admin_short_help()}>
        <Input name="short" maxLength={3} />
      </Field>
      <Field label={m.admin_description()}>
        <Input name="description" maxLength={200} />
      </Field>
    </FormDialog>
  )
}
