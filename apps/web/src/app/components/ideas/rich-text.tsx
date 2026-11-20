/**
 * Stored rich text (Quackback's TipTap JSON) as HTML in crazy-ui's `Prose`: headings, lists, quotes,
 * code, links and images look like the docs. The HTML is built by Quackback's own renderer (escaped
 * and URL-sanitized) and passed through DOMPurify in the browser as Quackback's client does.
 * Mentions become links to the person's profile, opened inside the app.
 */
import { Prose } from '@crazy-staff/ui'
import { useNavigate } from '@tanstack/react-router'
import DOMPurify from 'dompurify'
import type { JSONContent } from '@tiptap/core'
import { useEffect, useMemo, useState, type MouseEvent } from 'react'
import { generateContentHTML } from '@/lib/shared/content-html'

/** The look of a mention in text: accent, medium weight, no underline until hovered. */
export const MENTION_CLASS =
  'mention rounded-sm font-medium text-accent no-underline! outline-none hover:underline! focus-visible:ring-2 focus-visible:ring-ring'

/** Quackback's mention chip (`<span class="mention" data-principal-id …>@Name</span>`). */
const MENTION_SPAN =
  /<span class="mention" data-principal-id="(principal_[0-9a-z]{26})"([^>]*)>([^<]*)<\/span>/g

/** Mention chips as links to the person's profile (the name inside is already escaped). */
export function mentionsAsLinks(html: string): string {
  return html.replace(
    MENTION_SPAN,
    (_all, id: string, attrs: string, name: string) =>
      `<a class="${MENTION_CLASS}" href="/u/${id}" data-principal-id="${id}"${attrs}>${name}</a>`
  )
}

export function RichText({
  json,
  text,
  size = 'md',
}: {
  json: unknown
  /** Shown as plain paragraphs when there is no rich text. */
  text?: string
  size?: 'sm' | 'md'
}) {
  const navigate = useNavigate()
  const raw = useMemo(
    () =>
      json && typeof json === 'object'
        ? mentionsAsLinks(generateContentHTML(json as JSONContent))
        : null,
    [json]
  )
  // a mention opens the profile inside the app instead of reloading the page
  const onClick = (e: MouseEvent) => {
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[data-principal-id]')
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    void navigate({ to: '/u/$principalId', params: { principalId: link.dataset.principalId! } })
  }
  // the same HTML on the server and in the first client render (no hydration mismatch); DOMPurify
  // runs once mounted
  const [html, setHtml] = useState(raw)
  useEffect(() => setHtml(raw ? DOMPurify.sanitize(raw) : null), [raw])
  if (html) {
    return (
      <Prose
        size={size}
        className="max-w-none"
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    )
  }
  return text ? (
    <Prose size={size} className="max-w-none">
      {text.split(/\n{2,}/).map((part, i) => (
        <p key={i} className="whitespace-pre-wrap">
          {part}
        </p>
      ))}
    </Prose>
  ) : null
}
