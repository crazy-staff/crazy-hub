/**
 * The text field of ideas and comments (#5): markdown with a toolbar (bold, italic, heading, lists,
 * quote, code, link, image upload) and a preview tab. The server turns the markdown into the rich text
 * Quackback stores (`markdownToContentFn`), so ideas read as formatted text, not a wall of characters.
 */
import { Prose, Tabs, Textarea, cn, toast } from '@crazy-staff/ui'
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
import { useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { m } from '../../paraglide/messages.js'

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

export function MarkdownEditor({
  value,
  onChange,
  label,
  placeholder,
  rows = 6,
  maxLength = 10000,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  placeholder?: string
  rows?: number
  maxLength?: number
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const file = useRef<HTMLInputElement>(null)
  const [tab, setTab] = useState('write')
  const [uploading, setUploading] = useState(false)

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

  return (
    <div className="flex flex-col rounded-control border border-border bg-surface">
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
          aria-label={label}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
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
            <Prose size="sm" className="max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
            </Prose>
          ) : (
            <p className="text-sm text-muted">{m.editor_nothing()}</p>
          )}
        </div>
      )}
    </div>
  )
}
