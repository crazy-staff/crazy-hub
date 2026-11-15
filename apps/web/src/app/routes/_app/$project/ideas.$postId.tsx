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
import { useState } from 'react'
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
import { errorMessage } from '../../../lib/admin'

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
    void context.queryClient.prefetchQuery(portalQueries.statuses())
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
      <article className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <Link
            to="/$project/ideas"
            params={{ project: project.slug }}
            className="me-auto inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> {m.ideas_back()}
          </Link>
          {mine && (
            <>
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <Pencil /> {m.admin_edit()}
              </Button>
              <AlertDialog
                trigger={
                  <Button variant="ghost" size="sm">
                    <Trash2 /> {m.admin_delete()}
                  </Button>
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
          <VoteButton postId={post.id} voteCount={post.voteCount} size="lg" />
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
                {post.authorName ?? '—'} · {formatDate(post.createdAt)}
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
  const [title, setTitle] = useState(initialTitle)
  const [body, setBody] = useState(content)
  return (
    <FormDialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={m.ideas_edit()}
      dirty={title !== initialTitle || body !== content}
      onSubmit={async () => {
        const markdown = body.trim()
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
      <Field label={m.ideas_title()} required>
        <Input
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
        />
      </Field>
      <MarkdownEditor label={m.ideas_description()} value={body} onChange={setBody} />
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

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{m.ideas_comments()}</h2>
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
        <ol className="flex flex-col gap-5">
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
  )
}

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
    <div className="flex flex-col gap-2">
      <MarkdownEditor
        label={m.ideas_comment()}
        placeholder={m.ideas_comment_placeholder()}
        rows={parentId ? 2 : 3}
        maxLength={5000}
        value={draft}
        onChange={setDraft}
        autoFocus={autoFocus}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={!draft.trim() || busy} onClick={submit}>
          {parentId ? m.ideas_reply() : m.ideas_comment()}
        </Button>
        {onDone && (
          <Button size="sm" variant="ghost" onClick={onDone}>
            {m.admin_cancel()}
          </Button>
        )}
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
  const removed = !!comment.deletedAt
  const mine = !!me && comment.principalId === me.principalId
  const json = (comment as { contentJson?: unknown }).contentJson

  return (
    <li
      id={`comment-${comment.id}`}
      className="flex scroll-mt-24 gap-3 rounded-card transition-shadow"
    >
      <Avatar
        size="sm"
        className="size-8 shrink-0"
        src={comment.avatarUrl ?? undefined}
        name={comment.authorName ?? '?'}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-medium">{comment.authorName ?? '—'}</span>
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
                  <DropdownMenu.Item
                    onClick={() =>
                      act(() => userDeleteCommentFn({ data: { commentId: comment.id } }))
                    }
                  >
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
        {canReply && !removed && !editing && (
          <button
            type="button"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
            onClick={() => setReplying((v) => !v)}
          >
            <Reply className="size-3.5" /> {m.ideas_reply()}
          </button>
        )}
        {replying && (
          <CommentComposer
            postId={postId}
            parentId={comment.id}
            autoFocus
            onDone={() => setReplying(false)}
          />
        )}
        {root && comment.replies?.length > 0 && (
          // one level only (owner's note): every reply of the thread sits here, oldest first; a
          // reply to a reply shows what it answers and jumps there
          <ol className="mt-3 flex flex-col gap-4 border-s border-border ps-4">
            {flattenThread(comment).map(({ reply, parent }) => (
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
    <div className="flex flex-col gap-2">
      <MarkdownEditor
        label={m.admin_edit()}
        rows={3}
        maxLength={5000}
        value={draft}
        onChange={setDraft}
        autoFocus
      />
      <div className="flex gap-2">
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
        <Button size="sm" variant="ghost" onClick={onDone}>
          {m.admin_cancel()}
        </Button>
      </div>
    </div>
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

/** "Replying to Name: snippet": a click scrolls to that comment and highlights it for a moment. */
function ReplyToChip({ parent }: { parent: PublicCommentView }) {
  const snippet = parent.deletedAt
    ? m.ideas_comment_removed()
    : parent.content.replace(/\s+/g, ' ').slice(0, 80)
  return (
    <button
      type="button"
      onClick={() => {
        const target = document.getElementById(`comment-${parent.id}`)
        if (!target) return
        target.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target.classList.add('ring-2', 'ring-accent/60')
        setTimeout(() => target.classList.remove('ring-2', 'ring-accent/60'), 1600)
      }}
      className="flex w-fit max-w-full items-center gap-1.5 rounded-control-sm border-s-2 border-accent/60 bg-surface-2/60 px-2 py-1 text-start text-xs text-muted hover:bg-hover"
    >
      <Reply className="size-3 shrink-0" />
      <span className="shrink-0 font-medium text-foreground">{parent.authorName ?? '—'}</span>
      <span className="truncate">{snippet}</span>
    </button>
  )
}
