import {
  Alert,
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
  DropdownMenu,
  Field,
  Input,
  Select,
  cn,
  toast,
} from '@crazy-staff/ui'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import {
  createFileRoute,
  Link,
  notFound,
  useNavigate,
  useRouteContext,
} from '@tanstack/react-router'
import {
  ArrowLeft,
  CircleMinus,
  CirclePlus,
  CornerUpLeft,
  EyeOff,
  Lock,
  LockOpen,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Reply,
  RotateCcw,
  Tags,
  Trash2,
} from 'lucide-react'
import { createContext, useContext, useState } from 'react'
import type { PostCommentId, PostId } from '@quackback/ids'
import { portalDetailQueries, type PublicCommentView } from '@/lib/client/queries/portal-detail'
import { portalQueries } from '@/lib/client/queries/portal'
import { publicPostsKeys } from '@/lib/client/hooks/use-portal-posts-query'
import {
  createCommentFn,
  userDeleteCommentFn,
  userEditCommentFn,
} from '@/lib/server/functions/comments'
import { userEditPostFn } from '@/lib/server/functions/public-posts'
import {
  deleteIdeaFn,
  getIdeaPermissionsFn,
  lockCommentsFn,
  markdownToContentFn,
  pinCommentFn,
  removeCommentFn,
  restoreCommentFn,
  setIdeaStatusFn,
  setIdeaTagsFn,
} from '@/lib/server/crazy/ideas-functions'
import { m } from '../../../paraglide/messages.js'
import { PageFrame } from '../../../components/page'
import { FormDialog } from '../../../components/form-dialog'
import { VoteButton } from '../../../components/ideas/vote-button'
import { StatusChip } from '../../../components/ideas/status-chip'
import { RichText } from '../../../components/ideas/rich-text'
import { MarkdownEditor } from '../../../components/ideas/markdown-editor'
import { TagPicker } from '../../../components/ideas/tag-picker'
import { openSignIn } from '../../../components/auth/auth-dialog'
import { IconButton } from '../../../components/icon-button'
import { AuthorLink } from '../../../components/author-link'
import { FollowButton } from '../../../components/ideas/follow-button'
import { ReactionChips, ReactionPicker, useReactions } from '../../../components/ideas/reactions'
import { errorMessage } from '../../../lib/admin'
import { useIdeaVotes } from '../../../lib/idea-mutations'
import { plainText } from '../../../lib/ideas'
import {
  composeIdea,
  composeProblem,
  splitIdea,
  splitProblem,
  type IdeaFields,
  type ProblemFields,
} from '../../../lib/idea-wizard'

/**
 * One idea (#5): vote, title, status, tags, author, the formatted text, the official response, a
 * notice when it was merged, and the comments with replies. Authors edit and delete their own idea and
 * comments; people with the project's moderation permissions (decision 13) get a moderation bar
 * (status, tags, lock comments, delete) and remove, restore and pin comments. Only ideas of the
 * project's boards open here; another project's idea is a 404.
 */
export const Route = createFileRoute('/_app/$project/ideas/$postId')({
  loader: async ({ context, params }) => {
    const post = await context.queryClient
      .ensureQueryData(portalDetailQueries.postDetail(params.postId as PostId))
      .catch(() => null)
    if (!post || !context.project.boards.some((b) => b.id === post.board.id)) throw notFound()
    // awaited: the status chip is rendered on the server too (no hydration mismatch)
    await context.queryClient.ensureQueryData(portalQueries.statuses())
    return { title: post.title }
  },
  head: ({ loaderData, match }) => ({
    meta: [{ title: `${loaderData?.title ?? ''} · ${match.context.project.name}` }],
  }),
  component: Idea,
})

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const formatDate = (value: Date | string) => dateFormat.format(new Date(value))

/** Runs a change, refreshes the idea and the lists; failures show as a toast. */
function useAct(postId: string) {
  const queryClient = useQueryClient()
  return async (run: () => Promise<unknown>, success?: string) => {
    try {
      await run()
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['portal', 'post', postId] }),
        queryClient.invalidateQueries({ queryKey: publicPostsKeys.lists() }),
      ])
      if (success) toast.success(success)
      return true
    } catch (err) {
      toast.error(errorMessage(err))
      return false
    }
  }
}

function useMe() {
  const me = useRouteContext({ from: '__root__', select: (c) => c.hub.me })
  return me
}

function Idea() {
  const { project } = Route.useRouteContext()
  const { postId } = Route.useParams()
  const navigate = useNavigate()
  const { data: post } = useSuspenseQuery(portalDetailQueries.postDetail(postId as PostId))
  const statuses = useQuery(portalQueries.statuses()).data ?? []
  const can = useQuery({
    queryKey: ['crazy', 'idea-permissions', postId],
    queryFn: () => getIdeaPermissionsFn({ data: { postId } }),
  }).data
  const me = useMe()
  const act = useAct(postId)
  const votes = useIdeaVotes([post.id]).data
  const [editing, setEditing] = useState(false)
  const status = statuses.find((s) => s.id === post.statusId)
  const mine = !!me && post.principalId === me.principalId
  const moderates = !!can && (can.status || can.tags || can.delete || can.comments)

  const queryClient = useQueryClient()
  /** Deletes, then leaves at once: the deleted idea must not stay on screen (owner's note). */
  const removeIdea = async () => {
    try {
      await deleteIdeaFn({ data: { postId } })
    } catch (err) {
      toast.error(errorMessage(err))
      return
    }
    await navigate({ to: '/$project/ideas', params: { project: project.slug }, replace: true })
    queryClient.removeQueries({ queryKey: ['portal', 'post', postId] })
    await queryClient.invalidateQueries({ queryKey: publicPostsKeys.lists() })
    toast.success(m.ideas_deleted())
  }

  return (
    <PageFrame>
      <article className="flex flex-col gap-8">
        <div className="flex items-center gap-2">
          <Link
            to="/$project/ideas"
            params={{ project: project.slug }}
            className="me-auto inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {m.ideas_back()}
          </Link>
          {me && <FollowButton postId={post.id} />}
          {mine && (
            <>
              <IconButton label={m.admin_edit()} onClick={() => setEditing(true)}>
                <Pencil />
              </IconButton>
              <AlertDialog
                trigger={
                  <IconButton label={m.admin_delete()} tone="danger">
                    <Trash2 />
                  </IconButton>
                }
                title={m.ideas_delete_confirm()}
                cancelLabel={m.admin_cancel()}
                actionLabel={m.admin_delete()}
                tone="danger"
                onAction={() => void removeIdea()}
              />
            </>
          )}
        </div>

        {post.mergeInfo && (
          <Alert title={m.ideas_merged()}>
            <Link
              to="/$project/ideas/$postId"
              params={{ project: project.slug, postId: post.mergeInfo.canonicalPostId }}
              className="underline underline-offset-2"
            >
              {post.mergeInfo.canonicalPostTitle}
            </Link>
          </Alert>
        )}

        {moderates && can && (
          <Card.Root className="flex flex-wrap items-center gap-2 border-dashed px-3 py-2">
            <span className="me-1 text-xs font-medium text-muted">{m.ideas_moderation()}</span>
            {can.status && (
              <Select
                size="sm"
                aria-label={m.ideas_status()}
                value={post.statusId}
                onValueChange={(next) =>
                  next &&
                  void act(
                    () => setIdeaStatusFn({ data: { postId, statusId: next } }),
                    m.settings_saved()
                  )
                }
                items={statuses.map((s) => ({ value: s.id, label: s.name }))}
              />
            )}
            {can.tags && (
              <TagsDialog postId={postId} current={post.tags.map((t) => t.id)} moderator />
            )}
            {can.comments && (
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  act(() => lockCommentsFn({ data: { postId, locked: !post.isCommentsLocked } }))
                }
              >
                {post.isCommentsLocked ? <LockOpen /> : <Lock />}
                {post.isCommentsLocked ? m.ideas_unlock_comments() : m.ideas_lock_comments()}
              </Button>
            )}
            {can.delete && (
              <AlertDialog
                trigger={
                  <Button variant="outline" size="sm" className="ms-auto text-danger">
                    <Trash2 /> {m.ideas_delete()}
                  </Button>
                }
                title={m.ideas_delete_confirm()}
                cancelLabel={m.admin_cancel()}
                actionLabel={m.admin_delete()}
                tone="danger"
                onAction={() => void removeIdea()}
              />
            )}
          </Card.Root>
        )}

        <header className="flex items-start gap-4">
          <VoteButton
            postId={post.id}
            voteCount={votes?.up[post.id] ?? post.voteCount}
            downvotes={votes?.down[post.id]}
            mine={votes?.mine[post.id] ?? null}
            size="lg"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-[1.75em] leading-tight font-semibold">{post.title}</h1>
            <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
              {status && <StatusChip name={status.name} color={status.color} />}
              {post.tags.map((tag) => (
                <Chip key={tag.id} size="sm" variant="neutral">
                  {tag.name}
                </Chip>
              ))}
              {mine && !can?.tags && (
                <TagsDialog postId={postId} current={post.tags.map((t) => t.id)} />
              )}
              {project.boards.length > 1 && (
                <Chip size="sm" variant="outline">
                  {post.board.name}
                </Chip>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <Avatar
                size="sm"
                className="size-6"
                src={post.authorAvatarUrl ?? undefined}
                name={post.authorName ?? '?'}
              />
              <span>
                <AuthorLink principalId={post.principalId}>{post.authorName ?? '—'}</AuthorLink> ·{' '}
                {formatDate(post.createdAt)}
              </span>
            </div>
          </div>
        </header>

        <RichText json={post.contentJson} text={post.content} />

        {post.pinnedComment && (
          <Card
            title={m.ideas_official_response()}
            className="border-accent/40 bg-accent-soft/30"
            footer={
              can?.comments ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => act(() => pinCommentFn({ data: { postId, commentId: null } }))}
                >
                  <PinOff /> {m.ideas_unpin()}
                </Button>
              ) : undefined
            }
          >
            <RichText
              size="sm"
              json={(post.pinnedComment as { contentJson?: unknown }).contentJson}
              text={post.pinnedComment.content}
            />
            <p className="mt-3 text-xs text-muted">
              {post.pinnedComment.authorName ?? '—'} · {formatDate(post.pinnedComment.createdAt)}
            </p>
          </Card>
        )}

        <Comments
          postId={post.id}
          comments={post.comments}
          canComment={!!post.canComment}
          locked={!!post.isCommentsLocked}
          pinnedId={post.pinnedCommentId}
          moderator={!!can?.comments}
        />
      </article>
      {editing && (
        <EditIdeaDialog
          postId={postId}
          title={post.title}
          content={post.content}
          onClose={() => setEditing(false)}
        />
      )}
    </PageFrame>
  )
}

/** The editable sections of a text the wizard wrote (labels as in the wizard). */
const IDEA_SECTIONS = [
  { key: 'what', label: m.wizard_idea_what, hint: m.wizard_idea_what_hint, rows: 3 },
  { key: 'how', label: m.wizard_idea_how, hint: m.wizard_idea_how_hint, rows: 4 },
  { key: 'why', label: m.wizard_idea_why, hint: m.wizard_idea_why_hint, rows: 2 },
] as const
const PROBLEM_SECTIONS = [
  { key: 'happened', label: m.wizard_happened, hint: m.wizard_happened_hint, rows: 4 },
  { key: 'steps', label: m.wizard_steps_to_reproduce, hint: m.wizard_optional, rows: 3 },
  { key: 'expected', label: m.wizard_expected, hint: m.wizard_optional, rows: 2 },
] as const

/**
 * Editing an idea (owner's note, round 4): a text the wizard wrote is edited in the same sections
 * (idea: what / how / why; problem: what happened / steps / expected + version) and composed back;
 * any other text is edited as one.
 */
function EditIdeaDialog({
  postId,
  title: initialTitle,
  content,
  onClose,
}: {
  postId: string
  title: string
  content: string
  onClose: () => void
}) {
  const act = useAct(postId)
  const [initial] = useState(() => {
    const idea = splitIdea(content)
    if (idea)
      return {
        kind: 'idea' as const,
        fields: idea as unknown as Record<string, string>,
        version: '',
      }
    const problem = splitProblem(content)
    if (problem)
      return {
        kind: 'problem' as const,
        fields: problem.fields as unknown as Record<string, string>,
        version: problem.version,
      }
    return {
      kind: 'text' as const,
      fields: { body: content } as Record<string, string>,
      version: '',
    }
  })
  const [title, setTitle] = useState(initialTitle)
  const [fields, setFields] = useState<Record<string, string>>(initial.fields)
  const [version, setVersion] = useState(initial.version)
  const [checked, setChecked] = useState(false)

  const markdown =
    initial.kind === 'idea'
      ? composeIdea(fields as unknown as IdeaFields)
      : initial.kind === 'problem'
        ? composeProblem(fields as unknown as ProblemFields, version)
        : (fields.body ?? '').trim()
  const firstKey = initial.kind === 'idea' ? 'what' : initial.kind === 'problem' ? 'happened' : null
  const missing = firstKey ? !(fields[firstKey] ?? '').trim() : false
  const sections = initial.kind === 'idea' ? IDEA_SECTIONS : PROBLEM_SECTIONS
  const set = (key: string) => (value: string) => setFields((all) => ({ ...all, [key]: value }))

  return (
    <FormDialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={m.ideas_edit()}
      dirty={
        title !== initialTitle ||
        version !== initial.version ||
        Object.keys(fields).some((k) => fields[k] !== initial.fields[k])
      }
      onSubmit={async () => {
        if (missing) {
          setChecked(true)
          throw new Error(m.wizard_required())
        }
        const contentJson = markdown ? await markdownToContentFn({ data: { markdown } }) : undefined
        // the dialog shows the error itself, so the change runs outside `act`
        await userEditPostFn({
          data: {
            postId: postId as PostId,
            title: title.trim(),
            content: markdown,
            contentJson: contentJson as never,
          },
        })
        await act(async () => {})
      }}
    >
      <Field label={m.ideas_title()} description={m.wizard_title_hint()} required>
        <Input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Field>
      {initial.kind === 'text' ? (
        <MarkdownEditor
          showLabel
          label={m.ideas_description()}
          value={fields.body ?? ''}
          onChange={set('body')}
        />
      ) : (
        <>
          {sections.map((section, i) => (
            <MarkdownEditor
              key={section.key}
              showLabel
              required={i === 0}
              label={section.label()}
              hint={section.hint()}
              error={i === 0 && checked && missing ? m.wizard_required() : null}
              rows={section.rows}
              value={fields[section.key] ?? ''}
              onChange={set(section.key)}
            />
          ))}
          {initial.kind === 'problem' && (
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
    </FormDialog>
  )
}

/** Tags of an idea: any tag for a moderator, the public tags for the author. */
function TagsDialog({
  postId,
  current,
  moderator,
}: {
  postId: string
  current: string[]
  moderator?: boolean
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

function Comments({
  postId,
  comments,
  canComment,
  locked,
  pinnedId,
  moderator,
}: {
  postId: string
  comments: PublicCommentView[]
  canComment: boolean
  locked: boolean
  pinnedId: string | null
  moderator: boolean
}) {
  const me = useMe()
  const navigate = useNavigate()
  const visible = comments.filter((c) => c.id !== pinnedId)
  const total = countComments(visible)
  // collapsed threads, remembered while the page is open (refetches keep them)
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())
  const threads = {
    isCollapsed: (id: string) => collapsed.has(id),
    set: (id: string, closed: boolean) =>
      setCollapsed((all) => {
        const next = new Set(all)
        if (closed) next.add(id)
        else next.delete(id)
        return next
      }),
  }

  return (
    <ThreadsContext value={threads}>
      <section className="mt-2 flex flex-col gap-6 border-t border-border pt-8">
        <h2 className="text-lg font-semibold">
          {m.ideas_comments()}
          {total > 0 && (
            <span className="ms-2 text-sm font-normal text-muted tabular-nums">{total}</span>
          )}
        </h2>
        {locked ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Lock className="size-4" /> {m.ideas_comments_locked()}
          </p>
        ) : !me ? (
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => void navigate({ to: '.', search: openSignIn })}
          >
            {m.ideas_sign_in_to_comment()}
          </Button>
        ) : canComment ? (
          <CommentComposer postId={postId} />
        ) : null}
        {visible.length === 0 ? (
          <p className="text-sm text-muted">{m.ideas_no_comments()}</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-8">
            {visible.map((comment) => (
              <CommentItem
                key={comment.id}
                postId={postId}
                comment={comment}
                canReply={canComment && !locked && !!me}
                moderator={moderator}
                root
              />
            ))}
          </ol>
        )}
      </section>
    </ThreadsContext>
  )
}

/** Which threads are collapsed (kept by `Comments`, so it survives refetches while on the page). */
const ThreadsContext = createContext<{
  isCollapsed: (id: string) => boolean
  set: (id: string, collapsed: boolean) => void
}>({ isCollapsed: () => false, set: () => {} })

function CommentComposer({
  postId,
  parentId,
  onDone,
  autoFocus,
}: {
  postId: string
  parentId?: string
  onDone?: () => void
  autoFocus?: boolean
}) {
  const act = useAct(postId)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const markdown = draft.trim()
    if (!markdown) return
    setBusy(true)
    const ok = await act(async () => {
      const contentJson = await markdownToContentFn({ data: { markdown } })
      await createCommentFn({
        data: {
          postId: postId as PostId,
          content: markdown,
          contentJson: contentJson as never,
          parentId: parentId as PostCommentId | undefined,
        },
      })
    })
    setBusy(false)
    if (ok) {
      setDraft('')
      onDone?.()
    }
  }
  return (
    <div className="flex flex-col gap-3">
      <MarkdownEditor
        label={m.ideas_comment()}
        placeholder={m.ideas_comment_placeholder()}
        rows={parentId ? 2 : 3}
        maxLength={5000}
        value={draft}
        onChange={setDraft}
        autoFocus={autoFocus}
      />
      <div className="flex justify-end gap-2">
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            {m.admin_cancel()}
          </Button>
        )}
        <Button size="sm" disabled={!draft.trim() || busy} onClick={submit}>
          {parentId ? m.ideas_reply() : m.ideas_comment()}
        </Button>
      </div>
    </div>
  )
}

function CommentItem({
  postId,
  comment,
  canReply,
  moderator,
  root,
  replyTo,
}: {
  postId: string
  comment: PublicCommentView
  canReply: boolean
  moderator: boolean
  root?: boolean
  /** In a thread: the reply this one answers, when it isn't the thread's first comment. */
  replyTo?: PublicCommentView
}) {
  const me = useMe()
  const act = useAct(postId)
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const removed = !!comment.deletedAt
  const mine = !!me && comment.principalId === me.principalId
  const json = (comment as { contentJson?: unknown }).contentJson
  const threads = useContext(ThreadsContext)
  const thread = root && comment.replies?.length > 0 ? flattenThread(comment) : []
  const closed = threads.isCollapsed(comment.id)
  const reactions = useReactions(postId, comment.id, comment.reactions ?? [])

  return (
    <li
      id={`comment-${comment.id}`}
      className={cn(
        // the highlight after a jump uses the comment's own radius: a soft tint that fades out
        'squircle relative -m-3 flex scroll-mt-24 gap-3 rounded-card p-3',
        'transition-[background-color,box-shadow] duration-700 ease-out motion-reduce:transition-none',
        'data-[flash]:bg-accent-soft/40 data-[flash]:ring-1 data-[flash]:ring-accent/20 data-[flash]:duration-200'
      )}
    >
      <Avatar
        size="sm"
        className="size-8 shrink-0"
        src={comment.avatarUrl ?? undefined}
        name={comment.authorName ?? '?'}
      />
      {thread.length > 0 && (
        // the thread line under the avatar, as on Reddit (owner's note, round 4): it runs down past
        // the replies and lights up on hover; a click folds or unfolds the thread. Folded, it ends in
        // a curve that leads to the ⊕ "N replies" row.
        <>
          <button
            type="button"
            aria-label={m.ideas_toggle_replies()}
            aria-expanded={!closed}
            onClick={() => threads.set(comment.id, !closed)}
            className={cn(
              'group absolute start-3 top-[3.25rem] flex w-8 cursor-pointer justify-center outline-none',
              closed ? 'bottom-[2.25rem]' : 'bottom-3'
            )}
          >
            <span className="w-0.5 rounded-full bg-border transition-colors duration-150 group-hover:bg-accent group-focus-visible:bg-accent" />
          </button>
          {closed && (
            <span
              aria-hidden
              className="pointer-events-none absolute start-[calc(1.75rem-1px)] bottom-[calc(1.75rem-1px)] h-2.5 w-[calc(1.25rem+1px)] rounded-es-lg border-s-2 border-b-2 border-border"
            />
          )}
        </>
      )}
      {/* deleting asks first (owner's note, round 4) */}
      <AlertDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={m.ideas_comment_delete_confirm()}
        cancelLabel={m.admin_cancel()}
        actionLabel={m.admin_delete()}
        tone="danger"
        onAction={() => void act(() => userDeleteCommentFn({ data: { commentId: comment.id } }))}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-h-7 flex-wrap items-center gap-2 text-sm">
          <AuthorLink principalId={comment.principalId} className="font-medium">
            {comment.authorName ?? '—'}
          </AuthorLink>
          {comment.isTeamMember && (
            <Chip size="sm" variant="soft">
              {m.ideas_team()}
            </Chip>
          )}
          <span className="text-xs text-muted">{formatDate(comment.createdAt)}</span>
          {(mine || moderator) && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                render={<Button variant="ghost" size="icon-sm" className="ms-auto" />}
                aria-label={m.ideas_comment_actions()}
              >
                <MoreHorizontal />
              </DropdownMenu.Trigger>
              <DropdownMenu.Content align="end">
                {mine && !removed && (
                  <DropdownMenu.Item onClick={() => setEditing(true)}>
                    <Pencil /> {m.admin_edit()}
                  </DropdownMenu.Item>
                )}
                {mine && !removed && (
                  <DropdownMenu.Item danger onClick={() => setConfirmDelete(true)}>
                    <Trash2 /> {m.admin_delete()}
                  </DropdownMenu.Item>
                )}
                {moderator && root && !removed && (
                  <DropdownMenu.Item
                    onClick={() =>
                      act(() => pinCommentFn({ data: { postId, commentId: comment.id } }))
                    }
                  >
                    <Pin /> {m.ideas_pin()}
                  </DropdownMenu.Item>
                )}
                {moderator && !mine && !removed && (
                  <DropdownMenu.Item
                    danger
                    onClick={() => act(() => removeCommentFn({ data: { commentId: comment.id } }))}
                  >
                    <EyeOff /> {m.ideas_remove_comment()}
                  </DropdownMenu.Item>
                )}
                {moderator && removed && (
                  <DropdownMenu.Item
                    onClick={() => act(() => restoreCommentFn({ data: { commentId: comment.id } }))}
                  >
                    <RotateCcw /> {m.ideas_restore_comment()}
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          )}
        </div>
        {replyTo && <ReplyToChip parent={replyTo} />}
        {editing ? (
          <EditComment
            postId={postId}
            commentId={comment.id}
            content={comment.content}
            onDone={() => setEditing(false)}
          />
        ) : removed ? (
          <p className="text-sm text-muted italic">{m.ideas_comment_removed()}</p>
        ) : (
          <RichText size="sm" json={json} text={comment.content} />
        )}
        {!removed && !editing && (
          <ReactionChips
            reactions={reactions.shown}
            canReact={canReply}
            onToggle={(emoji) => void reactions.toggle(emoji)}
          />
        )}
        {((canReply && !removed && !editing) || thread.length > 0) && (
          <div className="relative -ms-2 flex min-h-8 items-center gap-1">
            {canReply && !removed && !editing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted"
                onClick={() => setReplying((v) => !v)}
              >
                <Reply /> {m.ideas_reply()}
              </Button>
            )}
            {canReply && !removed && !editing && (
              <ReactionPicker onPick={(emoji) => void reactions.toggle(emoji)} />
            )}
            {thread.length > 0 && !closed && (
              // ⊖ on the thread line, level with the actions (as on Reddit)
              <button
                type="button"
                aria-label={m.ideas_hide_replies()}
                onClick={() => threads.set(comment.id, true)}
                className="absolute -start-[1.875rem] top-1/2 flex size-5 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-background text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <CircleMinus className="size-4" />
              </button>
            )}
          </div>
        )}
        {replying && (
          <div className="mt-1">
            <CommentComposer
              postId={postId}
              parentId={comment.id}
              autoFocus
              onDone={() => {
                setReplying(false)
                threads.set(comment.id, false)
              }}
            />
          </div>
        )}
        {thread.length > 0 && closed && (
          <button
            type="button"
            aria-expanded={false}
            onClick={() => threads.set(comment.id, false)}
            className="mt-1 flex h-8 w-fit cursor-pointer items-center gap-2 rounded-control-sm pe-2 text-sm text-muted outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CirclePlus className="size-5 shrink-0" />
            <AvatarStack people={thread.map((t) => t.reply)} />
            {m.ideas_replies_count({ count: thread.length })}
          </button>
        )}
        {thread.length > 0 && !closed && (
          // one level only (owner's note): every reply of the thread sits here, oldest first; a
          // reply to a reply shows what it answers and jumps there
          <ol className="mt-4 flex flex-col gap-6">
            {thread.map(({ reply, parent }) => (
              <CommentItem
                key={reply.id}
                postId={postId}
                comment={reply}
                canReply={canReply}
                moderator={moderator}
                replyTo={parent.id === comment.id ? undefined : parent}
              />
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}

function EditComment({
  postId,
  commentId,
  content,
  onDone,
}: {
  postId: string
  commentId: string
  content: string
  onDone: () => void
}) {
  const act = useAct(postId)
  const [draft, setDraft] = useState(content)
  return (
    <div className="flex flex-col gap-3">
      <MarkdownEditor
        label={m.admin_edit()}
        rows={3}
        maxLength={5000}
        value={draft}
        onChange={setDraft}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>
          {m.admin_cancel()}
        </Button>
        <Button
          size="sm"
          disabled={!draft.trim()}
          onClick={async () => {
            const markdown = draft.trim()
            const ok = await act(async () => {
              const contentJson = await markdownToContentFn({ data: { markdown } })
              await userEditCommentFn({
                data: {
                  commentId: commentId as PostCommentId,
                  content: markdown,
                  contentJson: contentJson as never,
                },
              })
            })
            if (ok) onDone()
          }}
        >
          {m.settings_save()}
        </Button>
      </div>
    </div>
  )
}

/** Comments and all their replies, removed ones left out. */
function countComments(list: PublicCommentView[]): number {
  return list.reduce(
    (sum, c) =>
      sum + (c.deletedAt ? 0 : 1) + countComments((c.replies ?? []) as PublicCommentView[]),
    0
  )
}

/** Every reply under a thread's first comment, oldest first, with the comment each one answers. */
function flattenThread(rootComment: PublicCommentView) {
  const out: { reply: PublicCommentView; parent: PublicCommentView }[] = []
  const walk = (parent: PublicCommentView) => {
    for (const reply of (parent.replies ?? []) as PublicCommentView[]) {
      out.push({ reply, parent })
      walk(reply)
    }
  }
  walk(rootComment)
  return out.sort((a, b) => +new Date(a.reply.createdAt) - +new Date(b.reply.createdAt))
}

/** Up to three faces of a collapsed thread's repliers (each person once). */
function AvatarStack({ people }: { people: PublicCommentView[] }) {
  const seen = new Map<string, PublicCommentView>()
  for (const p of people) if (!seen.has(p.principalId ?? p.id)) seen.set(p.principalId ?? p.id, p)
  return (
    <span className="flex -space-x-0.5" aria-hidden>
      {[...seen.values()].slice(0, 3).map((p) => (
        <Avatar
          key={p.id}
          size="sm"
          className="size-5 ring-2 ring-background"
          classNames={{ fallback: 'text-[0.5rem]' }}
          src={p.avatarUrl ?? undefined}
          name={p.authorName ?? '?'}
        />
      ))}
    </span>
  )
}

/**
 * "Replying to Name: snippet" as a small muted quote line; a click scrolls to that comment and
 * tints it for a moment.
 */
function ReplyToChip({ parent }: { parent: PublicCommentView }) {
  const snippet = parent.deletedAt
    ? m.ideas_comment_removed()
    : plainText(parent.content).replace(/\s+/g, ' ').trim().slice(0, 100)
  return (
    <button
      type="button"
      title={m.ideas_reply_to({ name: parent.authorName ?? '—' })}
      onClick={() => {
        const target = document.getElementById(`comment-${parent.id}`)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.setAttribute('data-flash', '')
        setTimeout(() => target.removeAttribute('data-flash'), 1400)
      }}
      className={cn(
        'squircle -ms-2 flex w-fit max-w-full cursor-pointer items-center gap-1.5 rounded-control-sm px-2 py-1 text-start text-xs text-muted outline-none',
        'transition-colors hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring'
      )}
    >
      <CornerUpLeft className="size-3.5 shrink-0" />
      <span className="shrink-0 font-medium">{parent.authorName ?? '—'}</span>
      <span className="truncate opacity-80">{snippet}</span>
    </button>
  )
}
