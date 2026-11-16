import {
  Alert,
  AlertDialog,
  Avatar,
  Button,
  Card,
  Chip,
  Field,
  Input,
  toast,
} from '@crazy-staff/ui'
import { useQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Pencil, PinOff, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { PostId } from '@quackback/ids'
import { portalDetailQueries } from '@/lib/client/queries/portal-detail'
import { portalQueries } from '@/lib/client/queries/portal'
import { publicPostsKeys } from '@/lib/client/hooks/use-portal-posts-query'
import { userEditPostFn } from '@/lib/server/functions/public-posts'
import {
  deleteIdeaFn,
  editIdeaFn,
  getIdeaPermissionsFn,
  markdownToContentFn,
  pinCommentFn,
} from '@/lib/server/crazy/ideas-functions'
import { m } from '../../../paraglide/messages.js'
import { PageFrame } from '../../../components/page'
import { FormDialog } from '../../../components/form-dialog'
import { VoteButton } from '../../../components/ideas/vote-button'
import { StatusChip } from '../../../components/ideas/status-chip'
import { RichText } from '../../../components/ideas/rich-text'
import { MarkdownEditor } from '../../../components/ideas/markdown-editor'
import { IconButton } from '../../../components/icon-button'
import { AuthorLink } from '../../../components/author-link'
import { FollowButton } from '../../../components/ideas/follow-button'
import { Comments } from '../../../components/ideas/comments'
import { TagsDialog } from '../../../components/ideas/tags-dialog'
import { ModerationPanelContent } from '../../../components/ideas/moderation-panel'
import { SidePanel, SidePanelButton, useSidePanel } from '../../../components/side-panel'
import { errorMessage } from '../../../lib/admin'
import { formatDate, useAct, useMe } from '../../../lib/idea-act'
import { useIdeaVotes } from '../../../lib/idea-mutations'
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
 * comments; people with the project's moderation permissions (decision 13) get the moderation panel
 * on the right (status, board, tags, comments, delete; `components/ideas/moderation-panel.tsx`) and
 * remove, restore and pin comments. Only ideas of the
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

  const panel =
    moderates && can ? (
      <ModerationPanelContent
        post={post}
        project={project}
        can={can}
        statuses={statuses}
        votes={{ up: votes?.up[post.id] ?? post.voteCount, down: votes?.down[post.id] ?? 0 }}
      />
    ) : null

  const side = useSidePanel('idea-moderation')

  return (
    <PageFrame
      toc={
        panel && (
          <SidePanel panel={side} title={m.ideas_moderation()}>
            {panel}
          </SidePanel>
        )
      }
    >
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
          {panel && (
            <SidePanelButton panel={side} title={m.ideas_moderation()} icon={ShieldCheck}>
              {panel}
            </SidePanelButton>
          )}
          {/* the author's and the moderators' own buttons stay here; the panel only adds to them */}
          {(mine || can?.delete) && (
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
          asModerator={!mine}
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
  asModerator,
  onClose,
}: {
  postId: string
  title: string
  content: string
  /** Someone else's idea: saved through the moderators' `editIdeaFn`. */
  asModerator?: boolean
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
        if (asModerator) {
          await editIdeaFn({
            data: { postId, title: title.trim(), content: markdown, contentJson },
          })
        } else {
          await userEditPostFn({
            data: {
              postId: postId as PostId,
              title: title.trim(),
              content: markdown,
              contentJson: contentJson as never,
            },
          })
        }
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
