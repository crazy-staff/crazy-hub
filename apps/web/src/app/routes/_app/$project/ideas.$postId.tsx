import { Alert, Avatar, Button, Card, Chip, Textarea, toast } from '@crazy-staff/ui'
import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Lock } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import type { PostId } from '@quackback/ids'
import { portalDetailQueries, type PublicCommentView } from '@/lib/client/queries/portal-detail'
import { portalQueries } from '@/lib/client/queries/portal'
import { useCreateComment } from '@/lib/client/mutations/portal-comments'
import { useSessionContext } from '@/lib/client/hooks/use-root-context'
import { m } from '../../../paraglide/messages.js'
import { PageFrame } from '../../../components/page'
import { VoteButton } from '../../../components/ideas/vote-button'
import { StatusChip } from '../../../components/ideas/status-chip'
import { openSignIn } from '../../../components/auth/auth-dialog'

/**
 * One idea (#5): vote, title, status, tags, author, the text, the team's official response, a notice
 * when it was merged into another idea, and the comments. Only ideas of the project's boards open
 * here; another project's idea is a 404.
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

function Idea() {
  const { project } = Route.useRouteContext()
  const { postId } = Route.useParams()
  const { data: post } = useSuspenseQuery(portalDetailQueries.postDetail(postId as PostId))
  const statuses = useQuery(portalQueries.statuses()).data ?? []
  const status = statuses.find((s) => s.id === post.statusId)

  return (
    <PageFrame>
      <article className="flex flex-col gap-6">
        <Link
          to="/$project/ideas"
          params={{ project: project.slug }}
          className="inline-flex w-fit items-center gap-1.5 text-sm text-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {m.ideas_back()}
        </Link>

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

        {post.content && <p className="text-base whitespace-pre-wrap">{post.content}</p>}

        {post.pinnedComment && (
          <Card title={m.ideas_official_response()} className="border-accent/40 bg-accent-soft/30">
            <p className="whitespace-pre-wrap">{post.pinnedComment.content}</p>
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
        />
      </article>
    </PageFrame>
  )
}

function Comments({
  postId,
  comments,
  canComment,
  locked,
  pinnedId,
}: {
  postId: string
  comments: PublicCommentView[]
  canComment: boolean
  locked: boolean
  pinnedId: string | null
}) {
  const session = useSessionContext()
  const navigate = useNavigate()
  const user = session?.user && session.user.principalType !== 'anonymous' ? session.user : null
  const create = useCreateComment({
    postId: postId as PostId,
    author: user ? { name: user.name, email: user.email ?? '' } : undefined,
  })
  const [draft, setDraft] = useState('')
  const visible = comments.filter((c) => c.id !== pinnedId)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const content = draft.trim()
    if (!content) return
    try {
      await create.mutateAsync({ postId, content })
      setDraft('')
    } catch {
      toast.error(m.auth_error_generic())
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">{m.ideas_comments()}</h2>
      {locked ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Lock className="size-4" /> {m.ideas_comments_locked()}
        </p>
      ) : !user ? (
        <Button
          variant="outline"
          className="w-fit"
          onClick={() => void navigate({ to: '.', search: openSignIn })}
        >
          {m.ideas_sign_in_to_comment()}
        </Button>
      ) : canComment ? (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <Textarea
            aria-label={m.ideas_comment()}
            placeholder={m.ideas_comment_placeholder()}
            rows={3}
            maxLength={5000}
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
          />
          <Button type="submit" className="w-fit" disabled={!draft.trim() || create.isPending}>
            {m.ideas_comment()}
          </Button>
        </form>
      ) : null}
      {visible.length === 0 ? (
        <p className="text-sm text-muted">{m.ideas_no_comments()}</p>
      ) : (
        <ol className="flex flex-col gap-4">
          {visible.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ol>
      )}
    </section>
  )
}

function CommentItem({ comment }: { comment: PublicCommentView }) {
  const removed = !!comment.deletedAt || comment.isRemovedByTeam
  return (
    <li className="flex gap-3">
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
        </div>
        <p className={removed ? 'text-sm text-muted italic' : 'text-sm whitespace-pre-wrap'}>
          {removed ? m.ideas_comment_removed() : comment.content}
        </p>
        {comment.replies?.length > 0 && (
          <ol className="mt-3 flex flex-col gap-4 border-s border-border ps-4">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply as PublicCommentView} />
            ))}
          </ol>
        )}
      </div>
    </li>
  )
}
