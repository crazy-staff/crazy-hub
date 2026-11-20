/**
 * The text field of ideas and comments (#5): markdown with a toolbar (bold, italic, heading, lists,
 * quote, code, link, image upload) and a preview tab. The server turns the markdown into the rich text
 * Quackback stores (`markdownToContentFn`), so ideas read as formatted text, not a wall of characters.
 * Typing `@` suggests people; a pick writes a mention link (`lib/shared/crazy/mentions.ts`).
 */
import { Label, Prose, Tabs, Textarea, cn, toast } from '@crazy-staff/ui'
import {
  Bold,
  Code,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Quote,
  type LucideIcon,
} from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { useId, useRef, useState, type ComponentProps } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { insertMention, mentionQueryAt, mentionTarget } from '@/lib/shared/crazy/mentions'
import { m } from '../../paraglide/messages.js'
import { MentionSuggestions, useMentionPeople, type MentionPerson } from './mention-suggestions'
import { MENTION_CLASS } from './rich-text'

type Edit = (
  text: string,
  start: number,
  end: number
) => { text: string; start: number; end: number }

/** Wraps the selection (or a placeholder) in `before`/`after`. */
const wrap =
  (before: string, after = before, placeholder = ''): Edit =>
  (text, start, end) => {
    const picked = text.slice(start, end) || placeholder
    const next = text.slice(0, start) + before + picked + after + text.slice(end)
    return { text: next, start: start + before.length, end: start + before.length + picked.length }
  }

/** Prefixes every selected line (or the current one). */
const prefix =
  (mark: (index: number) => string): Edit =>
  (text, start, end) => {
    const lineStart = text.lastIndexOf('\n', start - 1) + 1
    const block = text.slice(lineStart, end)
    const lines = block.split('\n').map((line, i) => mark(i) + line)
    const replaced = lines.join('\n')
    return {
      text: text.slice(0, lineStart) + replaced + text.slice(end),
      start: lineStart,
      end: lineStart + replaced.length,
    }
  }

const TOOLS: { icon: LucideIcon; label: () => string; edit: Edit }[] = [
  { icon: Bold, label: m.editor_bold, edit: wrap('**', '**', 'bold') },
  { icon: Italic, label: m.editor_italic, edit: wrap('_', '_', 'italic') },
  { icon: Heading2, label: m.editor_heading, edit: prefix(() => '## ') },
  { icon: List, label: m.editor_list, edit: prefix(() => '- ') },
  { icon: ListOrdered, label: m.editor_ordered, edit: prefix((i) => `${i + 1}. `) },
  { icon: Quote, label: m.editor_quote, edit: prefix(() => '> ') },
  { icon: Code, label: m.editor_code, edit: wrap('`', '`', 'code') },
  { icon: Link2, label: m.editor_link, edit: wrap('[', '](https://)', 'text') },
]

/** Uploads an image through Quackback's portal upload route; returns its public URL. */
async function uploadImage(file: File): Promise<string> {
  const body = new FormData()
  body.append('file', file)
  const response = await fetch('/api/portal/upload', { method: 'POST', body })
  const result = (await response.json().catch(() => ({}))) as { publicUrl?: string; error?: string }
  if (!response.ok || !result.publicUrl) throw new Error(result.error ?? 'upload failed')
  return result.publicUrl
}

/** Links of the preview: a mention opens the profile inside the app, others stay links. */
function PreviewLink({
  href,
  children,
  node: _node,
  ...props
}: ComponentProps<'a'> & { node?: unknown }) {
  const principalId = mentionTarget(href)
  if (principalId && String(children).startsWith('@')) {
    return (
      <Link to="/u/$principalId" params={{ principalId }} className={MENTION_CLASS}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

/** Markdown rendered the way the stored idea will look (preview tab, wizard review). */
export function MarkdownView({ value, className }: { value: string; className?: string }) {
  return (
    <Prose size="sm" className={cn('max-w-none', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: PreviewLink }}>
        {value}
      </ReactMarkdown>
    </Prose>
  )
}

export function MarkdownEditor({
  value,
  onChange,
  label,
  showLabel,
  required,
  hint,
  error,
  placeholder,
  rows = 6,
  maxLength = 10000,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  /** Show `label` above the editor (forms); otherwise it is only the accessible name (comments). */
  showLabel?: boolean
  required?: boolean
  /** Help text under the editor. */
  hint?: string
  /** Shown under the editor in the danger colour, and marks the field invalid. */
  error?: string | null
  placeholder?: string
  rows?: number
  maxLength?: number
  autoFocus?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState('write')
  const [uploading, setUploading] = useState(false)
  // the @-mention at the caret, and the one the person closed with Escape (by its position)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [dismissed, setDismissed] = useState<number | null>(null)
  const [active, setActive] = useState(0)
  const open = mention !== null && mention.start !== dismissed
  const { people, loading, ready } = useMentionPeople(open ? mention.query : null)
  const listId = `${id}-mentions`

  /** Reads the mention being typed at the caret (after typing, clicking or moving the caret). */
  const track = (el: HTMLTextAreaElement) => {
    const found =
      el.selectionStart === el.selectionEnd ? mentionQueryAt(el.value, el.selectionStart) : null
    if (found?.start !== mention?.start || found?.query !== mention?.query) {
      setMention(found)
      setActive(0)
    }
    if (!found) setDismissed(null)
  }

  const pick = (person: MentionPerson) => {
    const el = ref.current
    if (!el || !mention || !person.displayName) return
    const next = insertMention(
      value,
      mention.start,
      el.selectionStart,
      person.principalId,
      person.displayName
    )
    onChange(next.text)
    setMention(null)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(next.caret, next.caret)
    })
  }

  const apply = (edit: Edit) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = edit(value, start, end)
    onChange(next.text)
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(next.start, next.end)
    })
  }

  const insertImage = async (picked: File) => {
    setUploading(true)
    try {
      const url = await uploadImage(picked)
      apply((text, start, end) => {
        const snippet = `${start > 0 && text[start - 1] !== '\n' ? '\n' : ''}![${picked.name}](${url})\n`
        return {
          text: text.slice(0, start) + snippet + text.slice(end),
          start: start + snippet.length,
          end: start + snippet.length,
        }
      })
    } catch {
      toast.error(m.editor_upload_failed())
    } finally {
      setUploading(false)
    }
  }

  const button = cn(
    'squircle inline-flex size-8 items-center justify-center rounded-control-sm text-muted outline-none',
    'hover:bg-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:size-4'
  )

  const editor = (
    <div
      className={cn(
        'flex flex-col rounded-control border bg-surface transition-colors',
        error ? 'border-danger' : 'border-border focus-within:border-accent'
      )}
    >
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-1.5 py-1">
        <Tabs
          value={tab}
          onValueChange={(next) => setTab(String(next))}
          items={[
            { value: 'write', label: m.editor_write(), content: null },
            { value: 'preview', label: m.editor_preview(), content: null },
          ]}
          classNames={{ panel: 'hidden' }}
        />
        {tab === 'write' && (
          <div className="ms-auto flex flex-wrap items-center" role="toolbar" aria-label={label}>
            {TOOLS.map((tool) => (
              <button
                key={tool.label()}
                type="button"
                className={button}
                aria-label={tool.label()}
                title={tool.label()}
                onClick={() => apply(tool.edit)}
              >
                <tool.icon />
              </button>
            ))}
            <button
              type="button"
              className={button}
              aria-label={m.editor_image()}
              title={m.editor_image()}
              disabled={uploading}
              onClick={() => file.current?.click()}
            >
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            </button>
            <input
              ref={file}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                const picked = e.currentTarget.files?.[0]
                if (picked) void insertImage(picked)
                e.currentTarget.value = ''
              }}
            />
          </div>
        )}
      </div>
      {tab === 'write' ? (
        <Textarea
          ref={ref}
          id={`${id}-input`}
          aria-label={showLabel ? undefined : label}
          aria-required={required || undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint || error ? `${id}-hint` : undefined}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          value={value}
          role={open ? 'combobox' : undefined}
          aria-expanded={open || undefined}
          aria-controls={open ? listId : undefined}
          aria-autocomplete={open ? 'list' : undefined}
          aria-activedescendant={open && people.length > 0 ? `${listId}-${active}` : undefined}
          onChange={(e) => {
            onChange(e.currentTarget.value)
            track(e.currentTarget)
          }}
          onSelect={(e) => track(e.currentTarget)}
          onBlur={() => setMention(null)}
          onKeyDown={(e) => {
            if (!open) return
            if (e.key === 'Escape') {
              e.preventDefault()
              e.stopPropagation()
              setDismissed(mention.start)
            } else if (people.length > 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              const step = e.key === 'ArrowDown' ? 1 : -1
              setActive((i) => (i + step + people.length) % people.length)
            } else if (people.length > 0 && (e.key === 'Enter' || e.key === 'Tab')) {
              e.preventDefault()
              // a list still loading for what was just typed: wait instead of picking a stale row
              if (ready) pick(people[Math.min(active, people.length - 1)]!)
            }
          }}
          onPaste={(e) => {
            const pasted = [...e.clipboardData.files].find((f) => f.type.startsWith('image/'))
            if (pasted) {
              e.preventDefault()
              void insertImage(pasted)
            }
          }}
          className="rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0"
        />
      ) : (
        <div className="min-h-32 px-3 py-2">
          {value.trim() ? (
            <MarkdownView value={value} />
          ) : (
            <p className="text-sm text-muted">{m.editor_nothing()}</p>
          )}
        </div>
      )}
      {tab === 'write' && open && (
        <MentionSuggestions
          id={listId}
          people={people}
          loading={loading}
          active={active}
          onHover={setActive}
          onPick={pick}
        />
      )}
    </div>
  )

  if (!showLabel && !hint && !error) return editor
  return (
    <div className="flex flex-col gap-1.5">
      {showLabel && (
        <Label htmlFor={`${id}-input`} required={required}>
          {label}
        </Label>
      )}
      {editor}
      {(error || hint) && (
        <p
          id={`${id}-hint`}
          className={cn('text-xs', error ? 'font-medium text-danger' : 'text-muted')}
        >
          {error || hint}
        </p>
      )}
    </div>
  )
}
