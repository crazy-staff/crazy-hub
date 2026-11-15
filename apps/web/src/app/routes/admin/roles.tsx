import {
  Alert,
  AlertDialog,
  Avatar,
  Button,
  Card,
  Checkbox,
  Chip,
  Field,
  Input,
  Select,
  Switch,
  Tabs,
  cn,
  toast,
} from '@crazy-staff/ui'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Plus, X } from 'lucide-react'
import { useDeferredValue, useState } from 'react'
import {
  claimOwnerFn,
  deleteCategoryFn,
  deleteRoleFn,
  grantRoleFn,
  revokeRoleFn,
  saveCategoryFn,
  saveRoleFn,
  searchPeopleFn,
} from '@/lib/server/crazy/admin-functions'
import {
  CRAZY_PERMISSIONS,
  EDITABLE_PERMISSION_KEYS,
  sanitizePermissions,
} from '@/lib/shared/crazy/permissions'
import { m } from '../../paraglide/messages.js'
import { Page } from '../../components/page'
import { FormDialog, RowActions, text } from '../../components/admin/parts'
import {
  DISCORD_CHIP,
  DISCORD_LABEL,
  PERMISSION_LABEL,
  adminQueries,
  errorMessage,
  slugify,
  type CategoryAdmin,
  type PersonAdmin,
  type RoleAdmin,
  type RolesAdmin,
} from '../../lib/admin'
import { useProjects } from '../../lib/projects'

/** Role categories, roles and who holds them (decision 13, #22). */
export const Route = createFileRoute('/admin/roles')({
  loader: ({ context }) => context.queryClient.ensureQueryData(adminQueries.roles()),
  head: () => ({ meta: [{ title: `${m.admin_roles()} · crazy-hub` }] }),
  component: Roles,
})

function useAction() {
  const queryClient = useQueryClient()
  const router = useRouter()
  return async (run: () => Promise<unknown>, success?: string) => {
    try {
      await run()
      await queryClient.invalidateQueries({ queryKey: adminQueries.roles().queryKey })
      // the caller's own roles live in the root context
      await router.invalidate()
      if (success) toast.success(success)
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }
}

function Roles() {
  const { data } = useSuspenseQuery(adminQueries.roles())
  const [tab, setTab] = useState(data.me.canAssign || !data.me.canManage ? 'people' : 'roles')
  return (
    <Page title={m.admin_roles()} description={m.admin_roles_description()}>
      {!data.ownerExists && <ClaimOwner discord={data.me.discord} />}
      {(data.me.canAssign || data.me.canManage) && (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(String(value))}
          items={[
            ...(data.me.canAssign
              ? [{ value: 'people', label: m.roles_people(), content: <People data={data} /> }]
              : []),
            { value: 'roles', label: m.roles_roles(), content: <RoleList data={data} /> },
          ]}
          classNames={{ panel: 'pt-6' }}
        />
      )}
    </Page>
  )
}

function ClaimOwner({ discord }: { discord: RolesAdmin['me']['discord'] }) {
  const act = useAction()
  return (
    <Alert title={m.roles_claim_title()} className="mb-6">
      <span className="flex flex-col items-start gap-3">
        <span>{m.roles_claim_text()}</span>
        <span className="flex flex-wrap items-center gap-2">
          <Chip size="sm" variant={DISCORD_CHIP[discord]}>
            {DISCORD_LABEL[discord]()}
          </Chip>
          <Button size="sm" onClick={() => act(() => claimOwnerFn())}>
            {m.roles_claim()}
          </Button>
        </span>
      </span>
    </Alert>
  )
}

// ------------------------------------------------------------------------------------ people

function People({ data }: { data: RolesAdmin }) {
  const projects = useProjects()
  const act = useAction()
  const [giving, setGiving] = useState(false)
  const roles = data.categories.flatMap((c) => c.roles)
  const roleOf = (id: string) => roles.find((r) => r.id === id)
  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setGiving(true)}>
          <Plus /> {m.roles_give()}
        </Button>
      </div>
      {data.people.length === 0 ? (
        <p className="text-sm text-muted">{m.roles_nobody()}</p>
      ) : (
        <Card.Root className="divide-y divide-border">
          {data.people.map((person) => (
            <div key={person.principalId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Avatar size="sm" src={person.avatarUrl ?? undefined} name={person.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{person.name}</span>
                {person.email && (
                  <span className="truncate text-xs text-muted">{person.email}</span>
                )}
              </span>
              <Chip size="sm" variant={DISCORD_CHIP[person.discord]}>
                {DISCORD_LABEL[person.discord]()}
              </Chip>
              <span className="flex w-full flex-wrap gap-1.5 sm:w-auto">
                {person.assignments.map((assignment) => {
                  const role = roleOf(assignment.roleId)
                  if (!role) return null
                  const suspended = role.requiresDiscordMfa && person.discord !== 'ok'
                  const label = [role.name, projectName(assignment.projectId)]
                    .filter(Boolean)
                    .join(' · ')
                  return (
                    <span
                      key={assignment.id}
                      title={suspended ? m.roles_suspended_help() : undefined}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-chip border border-border ps-2 text-xs',
                        suspended && 'border-dashed text-muted'
                      )}
                    >
                      {label}
                      {suspended && <span>· {m.roles_suspended()}</span>}
                      <AlertDialog
                        trigger={
                          <button
                            type="button"
                            aria-label={`${m.roles_take()}: ${label}`}
                            className="flex size-6 items-center justify-center rounded-chip text-muted hover:bg-hover hover:text-foreground"
                          >
                            <X className="size-3" />
                          </button>
                        }
                        title={m.roles_take_confirm({ role: label, person: person.name })}
                        cancelLabel={m.admin_cancel()}
                        actionLabel={m.roles_take()}
                        tone="danger"
                        onAction={() =>
                          act(() => revokeRoleFn({ data: { assignmentId: assignment.id } }))
                        }
                      />
                    </span>
                  )
                })}
              </span>
            </div>
          ))}
        </Card.Root>
      )}
      {giving && <GiveRoleDialog data={data} onClose={() => setGiving(false)} />}
    </div>
  )
}

function GiveRoleDialog({ data, onClose }: { data: RolesAdmin; onClose: () => void }) {
  const projects = useProjects()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [query, setQuery] = useState('')
  const deferred = useDeferredValue(query.trim())
  const [person, setPerson] = useState<Omit<PersonAdmin, 'assignments'> | null>(null)
  const [roleId, setRoleId] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string | null>(projects[0]?.id ?? null)
  const role = data.categories.flatMap((c) => c.roles).find((r) => r.id === roleId)
  const results = useQuery({
    queryKey: ['crazy', 'admin', 'people', deferred],
    queryFn: () => searchPeopleFn({ data: { query: deferred } }),
    enabled: deferred.length >= 2 && !person,
  })

  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={m.roles_give()}
      submitLabel={m.roles_give()}
      onSubmit={async () => {
        if (!person || !role) throw new Error('missing')
        await grantRoleFn({
          data: {
            roleId: role.id,
            principalId: person.principalId,
            projectId: role.scope === 'project' ? projectId : null,
          },
        })
        await queryClient.invalidateQueries({ queryKey: adminQueries.roles().queryKey })
        await router.invalidate()
        toast.success(m.settings_saved())
      }}
    >
      <Field label={m.roles_person()} required>
        {person ? (
          <div className="flex items-center gap-3 rounded-control border border-border px-3 py-2">
            <Avatar size="sm" src={person.avatarUrl ?? undefined} name={person.name} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{person.name}</span>
              <span className="truncate text-xs text-muted">{person.email}</span>
            </span>
            <Chip size="sm" variant={DISCORD_CHIP[person.discord]}>
              {DISCORD_LABEL[person.discord]()}
            </Chip>
            <Button
              variant="ghost"
              size="icon-sm"
              type="button"
              aria-label={m.roles_person_change()}
              onClick={() => setPerson(null)}
            >
              <X />
            </Button>
          </div>
        ) : (
          <Input
            autoFocus
            placeholder={m.roles_person_search()}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        )}
      </Field>
      {!person && results.data && results.data.length > 0 && (
        <div role="listbox" className="-mt-2 flex flex-col rounded-control border border-border">
          {results.data.map((found) => (
            <button
              key={found.principalId}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => setPerson(found)}
              className="flex items-center gap-3 px-3 py-2 text-start hover:bg-hover"
            >
              <Avatar size="sm" src={found.avatarUrl ?? undefined} name={found.name} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{found.name}</span>
                <span className="truncate text-xs text-muted">{found.email}</span>
              </span>
              <Chip size="sm" variant={DISCORD_CHIP[found.discord]}>
                {DISCORD_LABEL[found.discord]()}
              </Chip>
            </button>
          ))}
        </div>
      )}
      <Field label={m.roles_role()} required>
        <Select
          aria-label={m.roles_role()}
          value={roleId}
          onValueChange={setRoleId}
          items={data.categories.flatMap((category) =>
            category.roles.map((r) => ({ value: r.id, label: `${category.name} · ${r.name}` }))
          )}
        />
      </Field>
      {role?.scope === 'project' && (
        <Field label={m.roles_project()} required>
          <Select
            aria-label={m.roles_project()}
            value={projectId}
            onValueChange={setProjectId}
            items={projects.map((p) => ({ value: p.id, label: p.name }))}
          />
        </Field>
      )}
    </FormDialog>
  )
}

// ------------------------------------------------------------------------------------- roles

type Editing =
  | { kind: 'category'; category?: CategoryAdmin }
  | { kind: 'role'; category: CategoryAdmin; role?: RoleAdmin }
  | null

function RoleList({ data }: { data: RolesAdmin }) {
  const act = useAction()
  const [editing, setEditing] = useState<Editing>(null)
  const canManage = data.me.canManage
  return (
    <div className="flex flex-col gap-4">
      {canManage && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing({ kind: 'category' })}>
            <Plus /> {m.roles_new_category()}
          </Button>
        </div>
      )}
      {data.categories.map((category) => (
        <Card.Root key={category.id} className="flex flex-col">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <span className="truncate font-semibold">{category.name}</span>
              {category.exclusive && (
                <Chip size="sm" variant="soft" title={m.roles_exclusive_help()}>
                  {m.roles_exclusive()}
                </Chip>
              )}
            </span>
            {canManage && (
              <RowActions
                onEdit={() => setEditing({ kind: 'category', category })}
                onDelete={
                  category.roles.length === 0
                    ? () => act(() => deleteCategoryFn({ data: { id: category.id } }))
                    : undefined
                }
                deleteTitle={m.roles_category_delete_confirm()}
              />
            )}
          </div>
          <div className="flex flex-col divide-y divide-border">
            {category.roles.map((role) => (
              <div key={role.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">{role.name}</span>
                  <span className="text-xs text-muted">
                    {role.permissions
                      .map((p) => PERMISSION_LABEL[p as keyof typeof PERMISSION_LABEL]?.())
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <Chip size="sm" variant="outline">
                  {role.scope === 'global' ? m.roles_scope_global() : m.roles_scope_project()}
                </Chip>
                {role.requiresDiscordMfa && (
                  <Chip size="sm" variant="neutral">
                    Discord · 2FA
                  </Chip>
                )}
                {role.system && (
                  <Chip size="sm" variant="neutral">
                    {m.roles_system()}
                  </Chip>
                )}
                <span className="w-20 text-end text-xs text-muted">
                  {m.roles_holders({ count: String(role.holders) })}
                </span>
                {canManage && (
                  <RowActions
                    onEdit={() => setEditing({ kind: 'role', category, role })}
                    onDelete={
                      role.system
                        ? undefined
                        : () => act(() => deleteRoleFn({ data: { id: role.id } }))
                    }
                    deleteTitle={m.roles_delete_confirm()}
                  />
                )}
              </div>
            ))}
            {canManage && (
              <div className="px-4 py-2.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing({ kind: 'role', category })}
                >
                  <Plus /> {m.roles_new_role()}
                </Button>
              </div>
            )}
          </div>
        </Card.Root>
      ))}
      {editing?.kind === 'category' && (
        <CategoryDialog
          key={editing.category?.id ?? 'new'}
          category={editing.category}
          onClose={() => setEditing(null)}
        />
      )}
      {editing?.kind === 'role' && (
        <RoleDialog
          key={editing.role?.id ?? 'new'}
          data={data}
          category={editing.category}
          role={editing.role}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function CategoryDialog({ category, onClose }: { category?: CategoryAdmin; onClose: () => void }) {
  const queryClient = useQueryClient()
  const [exclusive, setExclusive] = useState(category?.exclusive ?? false)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={category ? m.roles_edit_category() : m.roles_new_category()}
      submitLabel={category ? m.settings_save() : m.admin_create()}
      onSubmit={async (form) => {
        await saveCategoryFn({
          data: {
            id: category?.id,
            name: text(form, 'name'),
            slug: text(form, 'slug') || slugify(text(form, 'name')),
            exclusive,
          },
        })
        await queryClient.invalidateQueries({ queryKey: adminQueries.roles().queryKey })
      }}
    >
      <Field label={m.admin_name()} required>
        <Input name="name" required maxLength={80} defaultValue={category?.name} autoFocus />
      </Field>
      <Field label={m.admin_slug()} description={m.admin_slug_help()}>
        <Input
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={48}
          defaultValue={category?.slug}
        />
      </Field>
      <Switch
        label={m.roles_exclusive()}
        description={m.roles_exclusive_help()}
        checked={exclusive}
        onCheckedChange={setExclusive}
      />
    </FormDialog>
  )
}

function RoleDialog({
  data,
  category,
  role,
  onClose,
}: {
  data: RolesAdmin
  category: CategoryAdmin
  role?: RoleAdmin
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [categoryId, setCategoryId] = useState<string | null>(category.id)
  const [scope, setScope] = useState<'global' | 'project'>(role?.scope ?? 'project')
  const [permissions, setPermissions] = useState<string[]>(
    role ? sanitizePermissions(role.permissions, role.scope) : []
  )
  const [isPublic, setIsPublic] = useState(role?.isPublic ?? true)
  const [requiresDiscordMfa, setRequiresDiscordMfa] = useState(role?.requiresDiscordMfa ?? true)
  const available = EDITABLE_PERMISSION_KEYS.filter(
    (key) => scope === 'global' || CRAZY_PERMISSIONS[key].scope === 'project'
  )
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={role ? m.roles_edit_role() : m.roles_new_role()}
      submitLabel={role ? m.settings_save() : m.admin_create()}
      onSubmit={async (form) => {
        await saveRoleFn({
          data: {
            id: role?.id,
            categoryId: categoryId ?? category.id,
            name: text(form, 'name'),
            slug: role?.system ? role.slug : text(form, 'slug') || slugify(text(form, 'name')),
            scope,
            permissions: permissions.filter((p) => available.includes(p as never)),
            isPublic,
            requiresDiscordMfa,
          },
        })
        await queryClient.invalidateQueries({ queryKey: adminQueries.roles().queryKey })
      }}
    >
      <Field label={m.admin_name()} required>
        <Input name="name" required maxLength={80} defaultValue={role?.name} autoFocus />
      </Field>
      <Field label={m.admin_slug()} description={m.admin_slug_help()}>
        <Input
          name="slug"
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          maxLength={48}
          defaultValue={role?.slug}
          disabled={role?.system}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={m.roles_category()}>
          <Select
            aria-label={m.roles_category()}
            value={categoryId}
            onValueChange={setCategoryId}
            items={data.categories.map((c) => ({ value: c.id, label: c.name }))}
          />
        </Field>
        <Field label={m.roles_scope()}>
          <Select
            aria-label={m.roles_scope()}
            value={scope}
            disabled={role?.system}
            onValueChange={(next) => next && setScope(next as 'global' | 'project')}
            items={[
              { value: 'project', label: m.roles_scope_project() },
              { value: 'global', label: m.roles_scope_global() },
            ]}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{m.roles_permissions()}</legend>
        {available.map((key) => (
          <Checkbox
            key={key}
            label={PERMISSION_LABEL[key]()}
            checked={permissions.includes(key)}
            onCheckedChange={(on) =>
              setPermissions((list) => (on ? [...list, key] : list.filter((p) => p !== key)))
            }
          />
        ))}
      </fieldset>
      <Switch
        label={m.roles_public()}
        description={m.roles_public_help()}
        checked={isPublic}
        onCheckedChange={setIsPublic}
      />
      <Switch
        label={m.roles_requires_discord()}
        description={m.roles_requires_discord_help()}
        checked={requiresDiscordMfa}
        onCheckedChange={setRequiresDiscordMfa}
      />
    </FormDialog>
  )
}
