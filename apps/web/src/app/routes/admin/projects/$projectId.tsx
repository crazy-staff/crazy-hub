import {
  AlertDialog,
  Button,
  Card,
  Checkbox,
  Chip,
  Field,
  Input,
  Select,
  Switch,
  Tabs,
  Textarea,
  toast,
} from '@crazy-staff/ui'
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useRouter } from '@tanstack/react-router'
import { ArrowLeft, Plus, Star } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import {
  deleteDimensionFn,
  deleteDimensionValueFn,
  moveDimensionFn,
  moveDimensionValueFn,
  saveDimensionFn,
  saveDimensionValueFn,
  setProjectBoardsFn,
  createProjectBoardFn,
  updateProjectFn,
} from '@/lib/server/crazy/admin-functions'
import { SECTION_IDS } from '@/lib/shared/crazy/projects'
import { m } from '../../../paraglide/messages.js'
import { Page } from '../../../components/page'
import { Badge, FormDialog, RowActions, text } from '../../../components/admin/parts'
import {
  adminQueries,
  errorMessage,
  slugify,
  type DimensionAdmin,
  type ProjectAdmin,
  type ProjectsAdmin,
  type ValueAdmin,
} from '../../../lib/admin'
import { SECTION_META } from '../../../lib/projects'

/** One project's editor: general, sections, boards and dimensions (decision 13, #22). */
export const Route = createFileRoute('/admin/projects/$projectId')({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(adminQueries.projects())
    const project = data.projects.find((p) => p.id === params.projectId)
    if (!project) throw notFound()
    return { name: project.name }
  },
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.name ?? m.admin_projects()} · crazy-hub` }],
  }),
  component: ProjectEditor,
})

const STATUS_LABEL = {
  available: m.status_available,
  planned: m.status_planned,
  later: m.status_later,
} as const

function useRefresh() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async () => {
    await queryClient.invalidateQueries({ queryKey: adminQueries.projects().queryKey })
    // the sidebar and the start page read the projects from the root context
    await router.invalidate()
  }
}

/** Runs a change, then refreshes; a failure shows as a toast. */
function useAction() {
  const refresh = useRefresh()
  return async (run: () => Promise<unknown>, success?: string) => {
    try {
      await run()
      await refresh()
      if (success) toast.success(success)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
}

function ProjectEditor() {
  const { projectId } = Route.useParams()
  const { data } = useSuspenseQuery(adminQueries.projects())
  const project = data.projects.find((p) => p.id === projectId)
  const act = useAction()
  const [tab, setTab] = useState('general')
  if (!project) return null

  return (
    <Page
      title={project.name}
      description={`/${project.slug}`}
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link to="/admin/projects" />}
          >
            <ArrowLeft /> {m.admin_back()}
          </Button>
          {project.archived ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                act(() => updateProjectFn({ data: { id: project.id, archived: false } }))
              }
            >
              {m.project_restore()}
            </Button>
          ) : (
            <AlertDialog
              trigger={
                <Button variant="outline" size="sm">
                  {m.project_archive()}
                </Button>
              }
              title={m.project_archive_confirm()}
              description={m.project_archive_text()}
              cancelLabel={m.admin_cancel()}
              actionLabel={m.project_archive()}
              tone="danger"
              onAction={() =>
                act(() => updateProjectFn({ data: { id: project.id, archived: true } }))
              }
            />
          )}
        </div>
      }
    >
      <Tabs
        value={tab}
        onValueChange={(value) => setTab(String(value))}
        items={[
          { value: 'general', label: m.project_general(), content: <General project={project} /> },
          {
            value: 'sections',
            label: m.project_sections(),
            content: <Sections project={project} />,
          },
          {
            value: 'boards',
            label: m.project_boards(),
            content: <Boards project={project} data={data} />,
          },
          {
            value: 'dimensions',
            label: m.project_dimensions(),
            content: <Dimensions project={project} />,
          },
        ]}
        classNames={{ panel: 'pt-6' }}
      />
    </Page>
  )
}

function General({ project }: { project: ProjectAdmin }) {
  const act = useAction()
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const repo = text(form, 'buildsRepo')
    void act(
      () =>
        updateProjectFn({
          data: {
            id: project.id,
            name: text(form, 'name'),
            slug: text(form, 'slug'),
            short: text(form, 'short'),
            description: text(form, 'description'),
            buildsRepo: repo || null,
          },
        }),
      m.settings_saved()
    )
  }
  return (
    <Card.Root className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" key={project.id}>
        <Field label={m.admin_name()} required>
          <Input name="name" required maxLength={80} defaultValue={project.name} />
        </Field>
        <Field label={m.admin_slug()} description={m.admin_slug_help()} required>
          <Input
            name="slug"
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={48}
            defaultValue={project.slug}
          />
        </Field>
        <Field label={m.admin_short()} description={m.admin_short_help()}>
          <Input name="short" maxLength={3} defaultValue={project.short} />
        </Field>
        <Field label={m.admin_description()}>
          <Input name="description" maxLength={200} defaultValue={project.description} />
        </Field>
        <Field label={m.project_builds_repo()} description={m.project_builds_repo_help()}>
          <Input
            name="buildsRepo"
            placeholder="crazy-staff/crazy-gothic-trainer-builds"
            pattern="[\w.\-]+/[\w.\-]+"
            defaultValue={project.buildsRepo ?? ''}
          />
        </Field>
        <div>
          <Button type="submit">{m.settings_save()}</Button>
        </div>
      </form>
    </Card.Root>
  )
}

function Sections({ project }: { project: ProjectAdmin }) {
  const act = useAction()
  const enabled = new Set(project.sections)
  return (
    <Card description={m.project_sections_help()}>
      <div className="flex flex-col divide-y divide-border">
        {SECTION_IDS.map((section) => {
          const meta = SECTION_META[section]
          return (
            <Switch
              key={section}
              className="py-3"
              label={meta.label()}
              description={meta.description()}
              checked={enabled.has(section)}
              onCheckedChange={(on) =>
                act(() =>
                  updateProjectFn({
                    data: {
                      id: project.id,
                      // keep the canonical order
                      sections: SECTION_IDS.filter((s) => (s === section ? on : enabled.has(s))),
                    },
                  })
                )
              }
            />
          )
        })}
      </div>
    </Card>
  )
}

function Boards({ project, data }: { project: ProjectAdmin; data: ProjectsAdmin }) {
  const act = useAction()
  const [picked, setPicked] = useState<string[]>(project.boardIds)
  const [creating, setCreating] = useState(false)
  const projectName = (id: string | null) => data.projects.find((p) => p.id === id)?.name
  const newBoard = (
    <Button variant="outline" onClick={() => setCreating(true)}>
      <Plus /> {m.project_new_board()}
    </Button>
  )
  return (
    <Card description={data.boards.length ? m.project_boards_help() : m.project_no_boards()}>
      <div className="flex flex-col gap-3">
        {data.boards.map((board) => {
          const elsewhere =
            board.projectId && board.projectId !== project.id ? projectName(board.projectId) : null
          return (
            <Checkbox
              key={board.id}
              label={board.name}
              description={
                elsewhere
                  ? `/${board.slug} · ${m.project_board_elsewhere({ project: elsewhere })}`
                  : `/${board.slug}`
              }
              checked={picked.includes(board.id)}
              onCheckedChange={(on) =>
                setPicked((list) => (on ? [...list, board.id] : list.filter((b) => b !== board.id)))
              }
            />
          )
        })}
        <div className="mt-2 flex gap-2">
          {data.boards.length > 0 && (
            <Button
              onClick={() =>
                act(
                  () => setProjectBoardsFn({ data: { projectId: project.id, boardIds: picked } }),
                  m.settings_saved()
                )
              }
            >
              {m.settings_save()}
            </Button>
          )}
          {newBoard}
        </div>
      </div>
      {creating && (
        <NewBoardDialog
          projectId={project.id}
          onClose={() => setCreating(false)}
          onCreated={(boardId) => setPicked((list) => [...list, boardId])}
        />
      )}
    </Card>
  )
}

/** A new board, created and linked to this project at once. */
function NewBoardDialog({
  projectId,
  onClose,
  onCreated,
}: {
  projectId: string
  onClose: () => void
  onCreated: (boardId: string) => void
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
        onCreated(board.id)
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

type Editing =
  | { kind: 'dimension'; dimension?: DimensionAdmin }
  | { kind: 'value'; dimension: DimensionAdmin; value?: ValueAdmin }
  | null

function Dimensions({ project }: { project: ProjectAdmin }) {
  const act = useAction()
  const [editing, setEditing] = useState<Editing>(null)
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="me-auto text-sm text-muted">{m.project_dimensions_help()}</p>
        <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'dimension' })}>
          <Plus /> {m.dimension_new()}
        </Button>
      </div>
      {project.dimensions.length === 0 && (
        <p className="text-sm text-muted">{m.dimension_empty()}</p>
      )}
      {project.dimensions.map((dimension, index) => (
        <Card.Root key={dimension.id} className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold">{dimension.name}</span>
              <Chip size="sm" variant="outline">
                {dimension.slug}
              </Chip>
              <Chip size="sm" variant={dimension.usedInDocs ? 'soft' : 'neutral'}>
                {dimension.usedInDocs ? m.dimension_docs() : m.dimension_tag_only()}
              </Chip>
            </span>
            <RowActions
              first={index === 0}
              last={index === project.dimensions.length - 1}
              onMove={(direction) =>
                act(() => moveDimensionFn({ data: { id: dimension.id, direction } }))
              }
              onEdit={() => setEditing({ kind: 'dimension', dimension })}
              onDelete={() => act(() => deleteDimensionFn({ data: { id: dimension.id } }))}
              deleteTitle={m.dimension_delete_confirm()}
            />
          </div>
          <div className="flex flex-col divide-y divide-border">
            {dimension.values.map((value, i) => (
              <div key={value.id} className="flex items-center gap-3 px-4 py-2.5">
                <Badge text={value.short} muted={value.status !== 'available'} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <span className="truncate">{value.label}</span>
                    {dimension.defaultValue === value.slug && (
                      <Star
                        aria-label={m.value_default()}
                        className="size-3.5 shrink-0 fill-current text-accent"
                      />
                    )}
                    {value.status !== 'available' && (
                      <Chip size="sm" variant="neutral">
                        {STATUS_LABEL[value.status]()}
                      </Chip>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted">
                    {value.slug}
                    {value.description && ` · ${value.description}`}
                  </span>
                </span>
                <RowActions
                  first={i === 0}
                  last={i === dimension.values.length - 1}
                  onMove={(direction) =>
                    act(() => moveDimensionValueFn({ data: { id: value.id, direction } }))
                  }
                  onEdit={() => setEditing({ kind: 'value', dimension, value })}
                  onDelete={() => act(() => deleteDimensionValueFn({ data: { id: value.id } }))}
                  deleteTitle={m.value_delete_confirm()}
                />
              </div>
            ))}
            <div className="px-4 py-2.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing({ kind: 'value', dimension })}
              >
                <Plus /> {m.value_new()}
              </Button>
            </div>
          </div>
        </Card.Root>
      ))}
      {editing?.kind === 'dimension' && (
        <DimensionDialog
          key={editing.dimension?.id ?? 'new'}
          project={project}
          dimension={editing.dimension}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'value' && (
        <ValueDialog
          key={editing.value?.id ?? 'new'}
          dimension={editing.dimension}
          value={editing.value}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

/** Mounted while open; its fields start from `dimension` (or empty for a new one). */
function DimensionDialog({
  project,
  dimension,
  onClose,
}: {
  project: ProjectAdmin
  dimension?: DimensionAdmin
  onClose: () => void
}) {
  const refresh = useRefresh()
  const [usedInDocs, setUsedInDocs] = useState(dimension?.usedInDocs ?? true)
  const [defaultValue, setDefaultValue] = useState<string | null>(dimension?.defaultValue ?? null)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={dimension ? m.dimension_edit() : m.dimension_new()}
      submitLabel={dimension ? m.settings_save() : m.admin_create()}
      onSubmit={async (form) => {
        await saveDimensionFn({
          data: {
            id: dimension?.id,
            projectId: project.id,
            name: text(form, 'name'),
            slug: text(form, 'slug') || slugify(text(form, 'name')),
            usedInDocs,
            defaultValue,
          },
        })
        await refresh()
      }}
    >
      <Field label={m.admin_name()} required>
        <Input name="name" required maxLength={80} defaultValue={dimension?.name} autoFocus />
      </Field>
      <Field label={m.admin_slug()} description={m.admin_slug_help()}>
        <Input
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={48}
          defaultValue={dimension?.slug}
        />
      </Field>
      <Switch
        label={m.dimension_used_in_docs()}
        description={m.dimension_used_in_docs_help()}
        checked={usedInDocs}
        onCheckedChange={setUsedInDocs}
      />
      {dimension && dimension.values.length > 0 && (
        <Field label={m.dimension_default()} description={m.dimension_default_help()}>
          <Select
            aria-label={m.dimension_default()}
            value={defaultValue}
            onValueChange={setDefaultValue}
            items={dimension.values.map((v) => ({ value: v.slug, label: v.label }))}
          />
        </Field>
      )}
    </FormDialog>
  )
}

/** Mounted while open; its fields start from `value` (or empty for a new one). */
function ValueDialog({
  dimension,
  value,
  onClose,
}: {
  dimension: DimensionAdmin
  value?: ValueAdmin
  onClose: () => void
}) {
  const refresh = useRefresh()
  const [status, setStatus] = useState<ValueAdmin['status']>(value?.status ?? 'available')
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={value ? m.value_edit() : m.value_new()}
      submitLabel={value ? m.settings_save() : m.admin_create()}
      onSubmit={async (form) => {
        await saveDimensionValueFn({
          data: {
            id: value?.id,
            dimensionId: dimension.id,
            label: text(form, 'label'),
            slug: text(form, 'slug') || slugify(text(form, 'label')),
            short: text(form, 'short'),
            description: text(form, 'description'),
            status,
          },
        })
        await refresh()
      }}
    >
      <Field label={m.value_label()} required>
        <Input name="label" required maxLength={80} defaultValue={value?.label} autoFocus />
      </Field>
      <Field label={m.admin_slug()} description={m.admin_slug_help()}>
        <Input
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={48}
          defaultValue={value?.slug}
        />
      </Field>
      <Field label={m.admin_short()} description={m.admin_short_help()}>
        <Input name="short" maxLength={3} defaultValue={value?.short} />
      </Field>
      <Field label={m.admin_description()}>
        <Input name="description" maxLength={200} defaultValue={value?.description} />
      </Field>
      <Field label={m.value_status()}>
        <Select
          aria-label={m.value_status()}
          value={status}
          onValueChange={(next) => next && setStatus(next as ValueAdmin['status'])}
          items={(['available', 'planned', 'later'] as const).map((s) => ({
            value: s,
            label: STATUS_LABEL[s](),
          }))}
        />
      </Field>
    </FormDialog>
  )
}
