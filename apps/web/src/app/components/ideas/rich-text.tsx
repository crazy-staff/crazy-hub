/**
 * Stored rich text (Quackback's TipTap JSON) as HTML in crazy-ui's `Prose`: headings, lists, quotes,
 * code, links and images look like the docs. The HTML is built by Quackback's own renderer (escaped
 * and URL-sanitized) and passed through DOMPurify in the browser as Quackback's client does.
 */
import { Prose } from '@crazy-staff/ui'
import DOMPurify from 'dompurify'
import type { JSONContent } from '@tiptap/core'
import { useEffect, useMemo, useState } from 'react'
import { generateContentHTML } from '@/lib/shared/content-html'

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
  const raw = useMemo(
    () => (json && typeof json === 'object' ? generateContentHTML(json as JSONContent) : null),
    [json]
  )
  // the same HTML on the server and in the first client render (no hydration mismatch); DOMPurify
  // runs once mounted
  const [html, setHtml] = useState(raw)
  useEffect(() => setHtml(raw ? DOMPurify.sanitize(raw) : null), [raw])
  if (html) {
    return <Prose size={size} className="max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
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
