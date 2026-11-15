/**
 * Posting an idea or reporting a problem, step by step (owner's note, 2026-11-15): first the kind
 * (an idea or a problem), then what it concerns (the project's dimensions such as game and renderer,
 * a category, for problems the trainer version), then the details (fields that fit the kind), then a
 * review. The choices become `kind: value` tags (`type: idea|bug`, `game: …`, `category: …`); what
 * only moderators decide (priority, status, …) is not asked. Closing with changes asks first.
 */
import { Button, Chip, Dialog, Field, Input, Select, cn } from '@crazy-staff/ui'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { Bug, Check, Lightbulb, Pencil, type LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { portalQueries } from '@/lib/client/queries/portal'
import { useSimilarPosts } from '@/lib/client/hooks/use-similar-posts'
import { markdownToContentFn, setIdeaTagsFn } from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { useDiscardGuard } from '../form-dialog'
import type { HubProject } from '../../lib/projects'
import { useCreateIdea } from '../../lib/idea-mutations'
import { errorMessage } from '../../lib/admin'
import {
  composeIdea,
  composeProblem,
  matchTag,
  type IdeaFields,
  type IdeaKind,
  type ProblemFields,
} from '../../lib/idea-wizard'
import { IconButton } from '../icon-button'
import { MarkdownEditor, MarkdownView } from './markdown-editor'

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
  const [idea, setIdea] = useState<IdeaFields>({ what: '', how: '', why: '' })
  const [problem, setProblem] = useState<ProblemFields>({ happened: '', steps: '', expected: '' })
  /** Set when Next was pressed on an incomplete step: the missing fields then say so. */
  const [checked, setChecked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const texts = kind === 'problem' ? Object.values(problem) : Object.values(idea)
  const dirty = kind !== null || title.trim() !== '' || texts.some((t) => t.trim() !== '')
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

  const markdown = kind === 'problem' ? composeProblem(problem, version) : composeIdea(idea)
  const missingPick = (slug: string) => !picks[slug] || picks[slug] === ANY
  const missingTitle = title.trim().length === 0
  const missingText = (kind === 'problem' ? problem.happened : idea.what).trim().length === 0
  const canNext = [
    kind !== null,
    !!board && (kind !== 'problem' || dimensions.every((d) => !missingPick(d.slug))),
    !missingTitle && !missingText,
    true,
  ][step]
  const required = (missing: boolean) => (checked && missing ? m.wizard_required() : null)

  const goTo = (next: number) => {
    setChecked(false)
    setStep(next)
  }
  const next = () => {
    if (canNext) goTo(step + 1)
    else setChecked(true)
  }

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
        <StepIndicator step={step} onPick={goTo} />
        <Dialog.Body className="mt-2 flex min-h-80 flex-col gap-6">
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
                    goTo(1)
                  }}
                  className={cn(
                    'squircle flex flex-col items-start gap-3 rounded-card border p-5 text-start outline-none transition-colors',
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
                <Field label={m.ideas_board()} description={m.wizard_board_hint()} required>
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
                  description={kind === 'problem' ? m.wizard_dimension_hint() : m.wizard_any_hint()}
                  error={kind === 'problem' ? required(missingPick(dimension.slug)) : null}
                  errorMatch={true}
                  invalid={kind === 'problem' && checked && missingPick(dimension.slug)}
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
                description={m.wizard_title_hint()}
                error={required(missingTitle)}
                errorMatch={true}
                invalid={checked && missingTitle}
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
                    showLabel
                    required
                    label={m.wizard_happened()}
                    hint={m.wizard_happened_hint()}
                    error={required(missingText)}
                    rows={4}
                    value={problem.happened}
                    onChange={(happened) => setProblem((p) => ({ ...p, happened }))}
                  />
                  <MarkdownEditor
                    showLabel
                    label={m.wizard_steps_to_reproduce()}
                    placeholder={m.wizard_steps_hint()}
                    hint={m.wizard_optional()}
                    rows={3}
                    value={problem.steps}
                    onChange={(steps) => setProblem((p) => ({ ...p, steps }))}
                  />
                  <MarkdownEditor
                    showLabel
                    label={m.wizard_expected()}
                    hint={m.wizard_optional()}
                    rows={2}
                    value={problem.expected}
                    onChange={(expected) => setProblem((p) => ({ ...p, expected }))}
                  />
                </>
              ) : (
                <>
                  <MarkdownEditor
                    showLabel
                    required
                    label={m.wizard_idea_what()}
                    placeholder={m.wizard_idea_what_placeholder()}
                    hint={m.wizard_idea_what_hint()}
                    error={required(missingText)}
                    rows={3}
                    value={idea.what}
                    onChange={(what) => setIdea((i) => ({ ...i, what }))}
                  />
                  <MarkdownEditor
                    showLabel
                    label={m.wizard_idea_how()}
                    hint={m.wizard_idea_how_hint()}
                    rows={4}
                    value={idea.how}
                    onChange={(how) => setIdea((i) => ({ ...i, how }))}
                  />
                  <MarkdownEditor
                    showLabel
                    label={m.wizard_idea_why()}
                    hint={m.wizard_idea_why_hint()}
                    rows={2}
                    value={idea.why}
                    onChange={(why) => setIdea((i) => ({ ...i, why }))}
                  />
                </>
              )}
            </>
          )}

          {step === 3 && (
            <Review
              kind={kind}
              title={title}
              chips={[
                ...(project.boards.length > 1
                  ? [project.boards.find((b) => b.id === board)?.name ?? '']
                  : []),
                // only what was picked: "doesn't matter" is the default and says nothing
                ...dimensions.flatMap((d) => {
                  const value = d.values.find((v) => v.slug === picks[d.slug])
                  return value ? [`${d.name}: ${value.label}`] : []
                }),
                ...(category !== ANY
                  ? [`${m.wizard_category()}: ${categories.find((c) => c.id === category)?.label}`]
                  : []),
                ...(kind === 'problem' && version.trim()
                  ? [`${m.wizard_version()}: ${version.trim()}`]
                  : []),
              ]}
              sections={
                kind === 'problem'
                  ? [
                      [m.wizard_happened(), problem.happened],
                      [m.wizard_steps_to_reproduce(), problem.steps],
                      [m.wizard_expected(), problem.expected],
                    ]
                  : [
                      [m.wizard_idea_what(), idea.what],
                      [m.wizard_idea_how(), idea.how],
                      [m.wizard_idea_why(), idea.why],
                    ]
              }
              onEdit={goTo}
            />
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
            <Button variant="outline" type="button" onClick={() => goTo(step - 1)}>
              {m.wizard_back()}
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" disabled={step === 0 && !canNext} onClick={next}>
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

/**
 * Bigger numbered steps with the name under the number, joined by a line (#34); done steps show a
 * check and can be clicked to go back.
 */
function StepIndicator({ step, onPick }: { step: number; onPick: (step: number) => void }) {
  return (
    <ol className="mt-6 mb-2 flex items-start" aria-label={m.wizard_steps()}>
      {STEPS.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'current' : 'next'
        const circle = (
          <span
            className={cn(
              'flex size-9 items-center justify-center rounded-full border-2 text-sm font-semibold tabular-nums transition-colors',
              state === 'done' && 'border-accent bg-accent text-accent-foreground',
              state === 'current' && 'border-accent bg-accent-soft text-accent-soft-foreground',
              state === 'next' && 'border-border bg-surface text-muted'
            )}
          >
            {state === 'done' ? <Check className="size-4" strokeWidth={3} /> : i + 1}
          </span>
        )
        const text = (
          <span
            className={cn(
              'block text-sm leading-5',
              state === 'current' && 'font-semibold text-foreground',
              state === 'done' && 'text-foreground',
              state === 'next' && 'text-muted'
            )}
          >
            {label()}
          </span>
        )
        return (
          <li
            key={i}
            className="relative flex flex-1 flex-col items-center"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {i > 0 && (
              <span
                aria-hidden
                className={cn(
                  'absolute top-[1.0625rem] h-0.5 rounded-full transition-colors',
                  'start-[calc(-50%+1.75rem)] end-[calc(50%+1.75rem)]',
                  i <= step ? 'bg-accent' : 'bg-border'
                )}
              />
            )}
            {state === 'done' ? (
              <button
                type="button"
                className="group flex cursor-pointer flex-col items-center gap-2 rounded-control-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onPick(i)}
              >
                {circle}
                <span className="block group-hover:underline">{text}</span>
              </button>
            ) : (
              <span className="flex flex-col items-center gap-2">
                {circle}
                {text}
              </span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/**
 * The last step as a preview of the idea (#34): what it concerns as chips, the title as a heading,
 * every filled section as formatted text under its heading; each block has an edit button that
 * jumps back to its step.
 */
function Review({
  kind,
  title,
  chips,
  sections,
  onEdit,
}: {
  kind: IdeaKind | null
  title: string
  chips: string[]
  sections: [string, string][]
  onEdit: (step: number) => void
}) {
  const kindInfo = KINDS.find((k) => k.id === kind)
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted">{m.wizard_review_hint()}</p>
      <ReviewBlock label={m.wizard_step_context()} onEdit={() => onEdit(1)}>
        <div className="flex flex-wrap items-center gap-2">
          {kindInfo && (
            <Chip variant="soft">
              <kindInfo.icon /> {kindInfo.title()}
            </Chip>
          )}
          {chips.map((chip) => (
            <Chip key={chip} variant="neutral">
              {chip}
            </Chip>
          ))}
        </div>
      </ReviewBlock>
      <ReviewBlock label={m.wizard_step_details()} onEdit={() => onEdit(2)}>
        <div className="flex flex-col gap-5">
          <h3 className="text-xl leading-snug font-semibold text-foreground">{title}</h3>
          {sections
            .filter(([, text]) => text.trim())
            .map(([heading, text]) => (
              <section key={heading} className="flex flex-col gap-1.5">
                <h4 className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {heading}
                </h4>
                <MarkdownView value={text} />
              </section>
            ))}
        </div>
      </ReviewBlock>
    </div>
  )
}

function ReviewBlock({
  label,
  onEdit,
  children,
}: {
  label: string
  onEdit: () => void
  children: React.ReactNode
}) {
  return (
    <section className="squircle flex flex-col gap-3 rounded-card border border-border p-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium text-muted">{label}</h3>
        <IconButton
          label={m.wizard_edit_step({ step: label })}
          size="icon-sm"
          className="-my-1 -me-1"
          onClick={onEdit}
        >
          <Pencil />
        </IconButton>
      </div>
      {children}
    </section>
  )
}
