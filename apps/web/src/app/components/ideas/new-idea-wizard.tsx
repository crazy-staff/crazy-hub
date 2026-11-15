/**
 * Posting an idea or reporting a problem, step by step (owner's note, 2026-11-15): first the kind
 * (an idea or a problem), then what it concerns (the project's dimensions such as game and renderer,
 * a category, for problems the trainer version), then the details (fields that fit the kind), then a
 * review. The choices become `kind: value` tags (`type: idea|bug`, `game: …`, `category: …`); what
 * only moderators decide (priority, status, …) is not asked. Closing with changes asks first.
 */
import { Button, Dialog, Field, Input, Select, cn } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, Check, Lightbulb, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { useSimilarPosts } from '@/lib/client/hooks/use-similar-posts'
import { markdownToContentFn, setIdeaTagsFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { useDiscardGuard } from '../form-dialog'
import type { HubProject } from '../../lib/projects'
import { useCreateIdea } from '../../lib/idea-mutations'
import { errorMessage } from '../../lib/admin'
import { composeProblem, matchTag, type IdeaKind, type ProblemFields } from '../../lib/idea-wizard'
import { MarkdownEditor } from './markdown-editor'

const KINDS: { id: IdeaKind; icon: LucideIcon; title: () => string; text: () => string }[] = [
  { id: 'idea', icon: Lightbulb, title: m.wizard_kind_idea, text: m.wizard_kind_idea_text },
  { id: 'problem', icon: Bug, title: m.wizard_kind_problem, text: m.wizard_kind_problem_text },
]

const STEPS = [
  m.wizard_step_kind,
  m.wizard_step_context,
  m.wizard_step_details,
  m.wizard_step_review,
]

/** "Doesn't matter" in the selects (a Select value can't be empty). */
const ANY = '*'

export function NewIdeaWizard({
  project,
  boardId,
  onClose,
}: {
  project: HubProject
  boardId?: string
  onClose: () => void
}) {
  const navigate = useNavigate()
  const create = useCreateIdea()
  const tags = useQuery(portalQueries.tags()).data ?? []
  const [step, setStep] = useState(0)
  const [kind, setKind] = useState<IdeaKind | null>(null)
  const [board, setBoard] = useState<string | null>(boardId ?? project.boards[0]?.id ?? null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [category, setCategory] = useState<string>(ANY)
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [problem, setProblem] = useState<ProblemFields>({ happened: '', steps: '', expected: '' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const dirty = kind !== null || title.trim() !== '' || body.trim() !== ''
  const guard = useDiscardGuard(dirty && !busy)
  const similar = useSimilarPosts({ title })
  const boardSlugs = new Set(project.boards.map((b) => b.slug))
  const matches = (similar.posts ?? []).filter((p) => boardSlugs.has(p.boardSlug))

  const categories = useMemo(
    () =>
      tags
        .map((t) => ({ tag: t, match: /^category:\s*(.+)$/i.exec(t.name) }))
        .filter((t) => t.match)
        .map((t) => ({ id: t.tag.id, label: t.match![1] })),
    [tags]
  )
  const dimensions = project.dimensions.filter((d) => d.values.length > 0)

  const markdown = kind === 'problem' ? composeProblem(problem, version) : body.trim()
  const canNext = [
    kind !== null,
    !!board &&
      (kind !== 'problem' || dimensions.every((d) => picks[d.slug] && picks[d.slug] !== ANY)),
    title.trim().length > 0 && (kind !== 'problem' || problem.happened.trim().length > 0),
    true,
  ][step]

  const chosenTags = () => {
    const ids = new Set<string>()
    const type = matchTag(tags, 'type', kind === 'problem' ? 'bug' : 'idea')
    if (type) ids.add(type)
    for (const dimension of dimensions) {
      const value = dimension.values.find((v) => v.slug === picks[dimension.slug])
      const id = value && matchTag(tags, dimension.slug, value.label)
      if (id) ids.add(id)
    }
    if (category !== ANY) ids.add(category)
    return [...ids]
  }

  const submit = async () => {
    if (!board) return
    setBusy(true)
    setError(null)
    try {
      const contentJson = markdown ? await markdownToContentFn({ data: { markdown } }) : undefined
      const created = await create.mutateAsync({
        boardId: board,
        title: title.trim(),
        content: markdown,
        contentJson,
      })
      const tagIds = chosenTags()
      if (tagIds.length)
        await setIdeaTagsFn({ data: { postId: created.id, tagIds } }).catch(() => {})
      onClose()
      void navigate({
        to: '/$project/ideas/$postId',
        params: { project: project.slug, postId: created.id },
      })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const close = () => guard.request(onClose)

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close()
      }}
    >
      <Dialog.Content size="lg">
        <Dialog.Header>
          <Dialog.Title>
            {kind === 'problem' ? m.wizard_title_problem() : m.ideas_new()}
          </Dialog.Title>
        </Dialog.Header>
        <ol className="flex items-center gap-2 px-6 text-xs" aria-label={m.wizard_steps()}>
          {STEPS.map((label, i) => (
            <li
              key={i}
              className="flex flex-1 items-center gap-2"
              aria-current={i === step ? 'step' : undefined}
            >
              <span
                className={cn(
                  'flex size-5 shrink-0 items-center justify-center rounded-full border text-[0.625rem] font-semibold',
                  i < step && 'border-accent bg-accent text-accent-foreground',
                  i === step && 'border-accent text-accent',
                  i > step && 'border-border text-muted'
                )}
              >
                {i < step ? <Check className="size-3" /> : i + 1}
              </span>
              <span className={cn('truncate', i === step ? 'font-medium' : 'text-muted')}>
                {label()}
              </span>
              {i < STEPS.length - 1 && <span className="h-px flex-1 bg-border" />}
            </li>
          ))}
        </ol>
        <Dialog.Body className="flex min-h-72 flex-col gap-4">
          {step === 0 && (
            <div
              className="grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label={m.wizard_step_kind()}
            >
              {KINDS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === option.id}
                  onClick={() => {
                    setKind(option.id)
                    setStep(1)
                  }}
                  className={cn(
                    'squircle flex flex-col items-start gap-2 rounded-card border p-4 text-start outline-none transition-colors',
                    'hover:bg-hover focus-visible:ring-2 focus-visible:ring-ring',
                    kind === option.id ? 'border-accent bg-accent-soft/40' : 'border-border'
                  )}
                >
                  <span className="squircle flex size-9 items-center justify-center rounded-control-sm bg-accent-soft text-accent-soft-foreground [&_svg]:size-4">
                    <option.icon />
                  </span>
                  <span className="font-semibold">{option.title()}</span>
                  <span className="text-sm text-muted">{option.text()}</span>
                </button>
              ))}
            </div>
          )}

          {step === 1 && (
            <>
              {project.boards.length > 1 && (
                <Field label={m.ideas_board()} required>
                  <Select
                    aria-label={m.ideas_board()}
                    value={board}
                    onValueChange={setBoard}
                    items={project.boards.map((b) => ({ value: b.id, label: b.name }))}
                  />
                </Field>
              )}
              {dimensions.map((dimension) => (
                <Field
                  key={dimension.slug}
                  label={dimension.name}
                  required={kind === 'problem'}
                  description={kind === 'problem' ? undefined : m.wizard_any_hint()}
                >
                  <Select
                    aria-label={dimension.name}
                    placeholder={m.wizard_choose()}
                    value={picks[dimension.slug] ?? (kind === 'problem' ? null : ANY)}
                    onValueChange={(next) =>
                      next && setPicks((all) => ({ ...all, [dimension.slug]: next }))
                    }
                    items={[
                      ...(kind === 'problem' ? [] : [{ value: ANY, label: m.wizard_any() }]),
                      ...dimension.values
                        .filter((v) => v.status === 'available')
                        .map((v) => ({ value: v.slug, label: v.label })),
                    ]}
                  />
                </Field>
              ))}
              {categories.length > 0 && (
                <Field label={m.wizard_category()} description={m.wizard_category_hint()}>
                  <Select
                    aria-label={m.wizard_category()}
                    value={category}
                    onValueChange={(next) => next && setCategory(next)}
                    items={[
                      { value: ANY, label: m.wizard_any() },
                      ...categories.map((c) => ({ value: c.id, label: c.label })),
                    ]}
                  />
                </Field>
              )}
              {kind === 'problem' && (
                <Field label={m.wizard_version()} description={m.wizard_version_hint()}>
                  <Input
                    value={version}
                    maxLength={40}
                    onChange={(e) => setVersion(e.currentTarget.value)}
                  />
                </Field>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Field
                label={kind === 'problem' ? m.wizard_problem_title() : m.ideas_title()}
                required
              >
                <Input
                  required
                  maxLength={200}
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.currentTarget.value)}
                />
              </Field>
              {matches.length > 0 && (
                <div className="-mt-2 flex flex-col gap-1 rounded-control border border-border p-3 text-sm">
                  <span className="text-xs font-medium text-muted">{m.ideas_similar()}</span>
                  {matches.map((post) => (
                    <Link
                      key={post.id}
                      to="/$project/ideas/$postId"
                      params={{ project: project.slug, postId: post.id }}
                      className="flex items-center gap-2 rounded-control-sm px-1 py-0.5 hover:bg-hover"
                    >
                      <span className="w-8 shrink-0 text-end text-xs tabular-nums text-muted">
                        ▲ {post.voteCount}
                      </span>
                      <span className="truncate">{post.title}</span>
                    </Link>
                  ))}
                </div>
              )}
              {kind === 'problem' ? (
                <>
                  <MarkdownEditor
                    label={m.wizard_happened()}
                    placeholder={m.wizard_happened_hint()}
                    rows={4}
                    value={problem.happened}
                    onChange={(happened) => setProblem((p) => ({ ...p, happened }))}
                  />
                  <MarkdownEditor
                    label={m.wizard_steps_to_reproduce()}
                    placeholder={m.wizard_steps_hint()}
                    rows={3}
                    value={problem.steps}
                    onChange={(steps) => setProblem((p) => ({ ...p, steps }))}
                  />
                  <MarkdownEditor
                    label={m.wizard_expected()}
                    rows={2}
                    value={problem.expected}
                    onChange={(expected) => setProblem((p) => ({ ...p, expected }))}
                  />
                </>
              ) : (
                <MarkdownEditor
                  label={m.ideas_description()}
                  placeholder={m.ideas_description_placeholder()}
                  value={body}
                  onChange={setBody}
                />
              )}
            </>
          )}

          {step === 3 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted">{m.wizard_step_kind()}</dt>
              <dd>{KINDS.find((k) => k.id === kind)?.title()}</dd>
              {dimensions.map((d) => (
                <div key={d.slug} className="contents">
                  <dt className="text-muted">{d.name}</dt>
                  <dd>{d.values.find((v) => v.slug === picks[d.slug])?.label ?? m.wizard_any()}</dd>
                </div>
              ))}
              {categories.length > 0 && (
                <>
                  <dt className="text-muted">{m.wizard_category()}</dt>
                  <dd>{categories.find((c) => c.id === category)?.label ?? m.wizard_any()}</dd>
                </>
              )}
              <dt className="text-muted">{m.ideas_title()}</dt>
              <dd className="font-medium">{title}</dd>
              <dt className="text-muted">{m.ideas_description()}</dt>
              <dd className="line-clamp-6 whitespace-pre-wrap text-muted">{markdown || '—'}</dd>
            </dl>
          )}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </Dialog.Body>
        <Dialog.Footer>
          <Button variant="ghost" type="button" className="me-auto" onClick={close}>
            {m.admin_cancel()}
          </Button>
          {step > 0 && (
            <Button variant="outline" type="button" onClick={() => setStep(step - 1)}>
              {m.wizard_back()}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}>
              {m.wizard_next()}
            </Button>
          ) : (
            <Button type="button" disabled={busy} onClick={submit}>
              {kind === 'problem' ? m.wizard_report() : m.ideas_post()}
            </Button>
          )}
        </Dialog.Footer>
      </Dialog.Content>
      {guard.element}
    </Dialog.Root>
  )
}
