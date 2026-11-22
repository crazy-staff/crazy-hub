/**
 * The comments of an idea (#5): composer, threads one level deep (every reply of a thread sits under
 * its first comment, oldest first; a reply to a reply says what it answers), edit / delete / remove /
 * restore / pin, reactions.
 *
 * Threads look like YouTube's (owner's note, #45): a line runs down from the first comment's avatar
 * and curves into every reply's avatar; folded, it curves into "N replies". The line itself folds and
 * unfolds the thread (no separate button) and lights up as a whole when any part is hovered. A
 * thread whose comments are all removed is not shown at all.
 */
import { AlertDialog, Avatar, Button, Chip, cn } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import { AdaptiveMenu } from '../adaptive'
import {
  CornerUpLeft,
  EyeOff,
  Lock,
  MoreHorizontal,
  Pencil,
  Pin,
  Reply,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { createContext, useContext, useLayoutEffect, useRef, useState } from 'react'
import type { PostCommentId, PostId } from '@quackback/ids'
import type { PublicCommentView } from '@/lib/client/queries/portal-detail'
import {
  createCommentFn,
  userDeleteCommentFn,
  userEditCommentFn,
} from '@/lib/server/functions/comments'
import {
  markdownToContentFn,
  notifyCommentMentionsFn,
  pinCommentFn,
  removeCommentFn,
  restoreCommentFn,
} from '@/lib/server/crazy/ideas-functions'
import { m } from '../../paraglide/messages.js'
import { formatDate, useAct, useMe } from '../../lib/idea-act'
import { useDraft } from '../../lib/drafts'
import { plainText } from '../../lib/ideas'
import { AuthorLink } from '../author-link'
import { openSignIn } from '../auth/auth-dialog'
import { MarkdownEditor } from './markdown-editor'
import { RichText } from './rich-text'
import { ReactionChips, ReactionPicker, useReactions } from './reactions'

/** Which threads are folded (kept by `Comments`, so it survives refetches while on the page). */
const ThreadsContext = createContext<{
  isCollapsed: (id: string) => boolean
  set: (id: string, collapsed: boolean) => void
}>({ isCollapsed: () => false, set: () => {} })

/**
 * The thread line's colour: border, accent while any part of the line (marked `data-thread-line`) is
 * hovered or focused. `group/thread` sits on the thread's first comment.
 */
const LINE = cn(
  'border-border transition-colors duration-150',
  'group-has-[[data-thread-line]:hover]/thread:border-accent',
  'group-has-[[data-thread-line]:focus-visible]/thread:border-accent'
)
const LINE_BG = cn(
  'bg-border transition-colors duration-150',
  'group-has-[[data-thread-line]:hover]/thread:bg-accent',
  'group-has-[[data-thread-line]:focus-visible]/thread:bg-accent'
)

export function Comments({
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
  // a thread whose comments are all removed is left out (owner's note, #45)
  const visible = comments.filter((c) => c.id !== pinnedId && !allRemoved(c))
  const total = countComments(visible)
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
  // kept in the tab, so it survives the session ending (#5, sign in again)
  const [draft, setDraft, clearDraft] = useDraft(`comment:${postId}:${parentId ?? 'new'}`, '')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const markdown = draft.trim()
    if (!markdown) return
    setBusy(true)
    const ok = await act(async () => {
      const contentJson = await markdownToContentFn({ data: { markdown } })
      const created = await createCommentFn({
        data: {
          postId: postId as PostId,
          content: markdown,
          contentJson: contentJson as never,
          parentId: parentId as PostCommentId | undefined,
        },
      })
      notifyMentions(markdown, created.comment.id)
    })
    setBusy(false)
    if (ok) {
      clearDraft()
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
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              clearDraft()
              onDone()
            }}
          >
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

/*
 * Geometry of the thread line (the comment row is `-m-3 p-3`, avatar 32px, gap 12px):
 * - in the first comment's row the avatar's centre is 1.75rem from the row's edge and the text
 *   column starts at 3.5rem; the line starts at the avatar's edge (top 2.75rem);
 * - a reply's row starts 0.75rem left of the text column, so the line runs 1rem left of the reply
 *   row's edge, and the reply's avatar centre is 1.75rem down from the row's top; each curve is
 *   1.75rem tall with a 1.5rem radius and ends at the avatar's edge;
 * - unfolded, the line ends where the last reply's curve begins (measured, `railEnd`); folded, it
 *   curves into the "N replies" row, 2rem tall, its centre 1.75rem above the bottom of the row.
 */

function CommentItem({
  postId,
  comment,
  canReply,
  moderator,
  root,
  replyTo,
  inThread,
}: {
  postId: string
  comment: PublicCommentView
  canReply: boolean
  moderator: boolean
  root?: boolean
  /** In a thread: the reply this one answers, when it isn't the thread's first comment. */
  replyTo?: PublicCommentView
  /** A reply under a first comment: gets its curve from the thread line. */
  inThread?: boolean
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
  const thread = root ? flattenThread(comment) : []
  const closed = threads.isCollapsed(comment.id)
  const reactions = useReactions(postId, comment.id, comment.reactions ?? [])
  const toggle = () => threads.set(comment.id, !closed)
  // where the line ends when unfolded: the centre of the last reply's avatar, minus its curve
  const rowRef = useRef<HTMLLIElement>(null)
  const [railEnd, setRailEnd] = useState<number | null>(null)
  useLayoutEffect(() => {
    const row = rowRef.current
    if (!row || thread.length === 0 || closed) return
    const measure = () => {
      const avatars = row.querySelectorAll('[data-thread-avatar]')
      const last = avatars[avatars.length - 1]
      if (!last) return
      const a = last.getBoundingClientRect()
      setRailEnd(a.top + a.height / 2 - row.getBoundingClientRect().top)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(row)
    return () => observer.disconnect()
  }, [thread.length, closed])

  return (
    <li
      ref={rowRef}
      id={`comment-${comment.id}`}
      className={cn(
        // the highlight after a jump uses the comment's own radius: a soft tint that fades out
        'squircle relative -m-3 flex scroll-mt-24 gap-3 rounded-card p-3',
        'transition-[background-color,box-shadow] duration-700 ease-out motion-reduce:transition-none',
        'data-[flash]:bg-accent-soft/40 data-[flash]:ring-1 data-[flash]:ring-accent/20 data-[flash]:duration-200',
        root && 'group/thread'
      )}
    >
      {inThread && (
        // the curve from the thread line into this reply's avatar
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute -start-[calc(1rem+1px)] top-0 h-7 w-[calc(1.75rem+1px)] rounded-es-3xl border-s-2 border-b-2',
            LINE
          )}
        />
      )}
      <Avatar
        size="sm"
        data-thread-avatar={inThread ? '' : undefined}
        className="relative size-8 shrink-0"
        src={comment.avatarUrl ?? undefined}
        name={comment.authorName ?? '?'}
      />
      {thread.length > 0 && (
        <>
          {/* the thread line: down from the avatar; a click folds or unfolds the thread */}
          <button
            type="button"
            data-thread-line=""
            aria-label={closed ? m.ideas_show_replies() : m.ideas_hide_replies()}
            aria-expanded={!closed}
            onClick={toggle}
            className={cn(
              'absolute start-3 top-[2.75rem] flex w-8 cursor-pointer justify-center outline-none',
              (closed || railEnd === null) && 'bottom-[calc(3.5rem-2px)]'
            )}
            // unfolded: down to where the last reply's curve starts (1.75rem above its centre)
            style={!closed && railEnd !== null ? { height: railEnd - 44 - 28 + 2 } : undefined}
          >
            <span className={cn('w-0.5', LINE_BG)} />
          </button>
          {closed && (
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute start-[calc(1.75rem-1px)] bottom-[calc(1.75rem-1px)] h-7 w-[calc(1.75rem+1px)] rounded-es-3xl border-s-2 border-b-2',
                LINE
              )}
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
            <AdaptiveMenu
              title={m.ideas_comment_actions()}
              trigger={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ms-auto"
                  aria-label={m.ideas_comment_actions()}
                >
                  <MoreHorizontal />
                </Button>
              }
              entries={[
                ...(mine && !removed
                  ? [
                      { label: m.admin_edit(), icon: <Pencil />, onSelect: () => setEditing(true) },
                      {
                        label: m.admin_delete(),
                        icon: <Trash2 />,
                        danger: true,
                        onSelect: () => setConfirmDelete(true),
                      },
                    ]
                  : []),
                ...(moderator && root && !removed
                  ? [
                      {
                        label: m.ideas_pin(),
                        icon: <Pin />,
                        onSelect: () =>
                          void act(() => pinCommentFn({ data: { postId, commentId: comment.id } })),
                      },
                    ]
                  : []),
                ...(moderator && !mine && !removed
                  ? [
                      {
                        label: m.ideas_remove_comment(),
                        icon: <EyeOff />,
                        danger: true,
                        onSelect: () =>
                          void act(() => removeCommentFn({ data: { commentId: comment.id } })),
                      },
                    ]
                  : []),
                ...(moderator && removed
                  ? [
                      {
                        label: m.ideas_restore_comment(),
                        icon: <RotateCcw />,
                        onSelect: () =>
                          void act(() => restoreCommentFn({ data: { commentId: comment.id } })),
                      },
                    ]
                  : []),
              ]}
            />
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
        {canReply && !removed && !editing && (
          <div className="-ms-2 flex min-h-8 items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted"
              onClick={() => setReplying((v) => !v)}
            >
              <Reply /> {m.ideas_reply()}
            </Button>
            <ReactionPicker
              picked={reactions.shown.filter((r) => r.hasReacted).map((r) => r.emoji)}
              onPick={(emoji) => void reactions.toggle(emoji)}
            />
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
        {thread.length > 0 && !closed && (
          <ol className="mt-4 flex flex-col gap-6">
            {thread.map(({ reply, parent }) => (
              <CommentItem
                key={reply.id}
                postId={postId}
                comment={reply}
                canReply={canReply}
                moderator={moderator}
                replyTo={parent.id === comment.id ? undefined : parent}
                inThread
              />
            ))}
          </ol>
        )}
        {thread.length > 0 && closed && (
          // folded: the line curves into "N replies" (with the repliers' faces), which unfolds it
          <button
            type="button"
            data-thread-line=""
            aria-expanded={false}
            onClick={toggle}
            className="mt-1 flex h-8 w-fit cursor-pointer items-center gap-2 rounded-control-sm pe-2 text-sm font-medium text-accent outline-none transition-[filter] hover:brightness-110"
          >
            <AvatarStack people={thread.map((t) => t.reply)} />
            {m.ideas_replies_count({ count: thread.length })}
          </button>
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
  const [draft, setDraft, clearDraft] = useDraft(`edit-comment:${commentId}`, content)
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
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            clearDraft()
            onDone()
          }}
        >
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
              notifyMentions(markdown, commentId)
            })
            if (ok) {
              clearDraft()
              onDone()
            }
          }}
        >
          {m.settings_save()}
        </Button>
      </div>
    </div>
  )
}

/**
 * Tells the people mentioned in a comment just posted or edited (Quackback only does it for posts).
 * Runs in the background: a failure never blocks the comment.
 */
function notifyMentions(markdown: string, commentId: string) {
  if (!markdown.includes('](/u/principal_')) return
  notifyCommentMentionsFn({ data: { commentId } }).catch(() => {})
}

const replies = (c: PublicCommentView) => (c.replies ?? []) as PublicCommentView[]

/** True when the comment and everything under it is removed. */
export function allRemoved(comment: PublicCommentView): boolean {
  return !!comment.deletedAt && replies(comment).every(allRemoved)
}

/** Comments and all their replies, removed ones left out. */
export function countComments(list: PublicCommentView[]): number {
  return list.reduce((sum, c) => sum + (c.deletedAt ? 0 : 1) + countComments(replies(c)), 0)
}

/**
 * Every reply under a thread's first comment, oldest first, with the comment each one answers. A
 * removed reply that nobody kept answering is left out, like a removed thread.
 */
export function flattenThread(rootComment: PublicCommentView) {
  const out: { reply: PublicCommentView; parent: PublicCommentView }[] = []
  const walk = (parent: PublicCommentView) => {
    for (const reply of replies(parent)) {
      if (!allRemoved(reply)) out.push({ reply, parent })
      walk(reply)
    }
  }
  walk(rootComment)
  return out.sort((a, b) => +new Date(a.reply.createdAt) - +new Date(b.reply.createdAt))
}

/** Up to three faces of a folded thread's repliers (each person once). */
function AvatarStack({ people }: { people: PublicCommentView[] }) {
  const seen = new Map<string, PublicCommentView>()
  for (const p of people) if (!seen.has(p.principalId ?? p.id)) seen.set(p.principalId ?? p.id, p)
  const all = [...seen.values()]
  // up to three faces; more than three: two faces and "+N" for the rest (owner's note, round 6)
  const shown = all.length > 3 ? all.slice(0, 2) : all
  const more = all.length - shown.length
  const ring = 'size-6 ring-2 ring-background'
  return (
    <span className="flex -space-x-1.5" aria-hidden>
      {shown.map((p) => (
        <Avatar
          key={p.id}
          size="sm"
          className={ring}
          classNames={{ fallback: 'text-[0.5625rem]' }}
          src={p.avatarUrl ?? undefined}
          name={p.authorName ?? '?'}
        />
      ))}
      {more > 0 && (
        <span
          className={cn(
            ring,
            'relative flex items-center justify-center rounded-full bg-surface-2 text-[0.625rem] font-semibold text-muted tabular-nums'
          )}
        >
          +{more}
        </span>
      )}
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
