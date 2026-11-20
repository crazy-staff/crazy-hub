/**
 * @-mentions in ideas and comments (#5). The composer writes markdown, so a mention is a markdown link
 * to the person's profile, `[@Name](/u/principal_…)`: it reads as a link in the preview and in the
 * stored text, and `markdownToContentFn` turns it into Quackback's `mention` node (which drives the
 * mention notifications and keeps the name current when the person renames).
 */
import type { JSONContent } from '@tiptap/core'

/** A profile link that is a mention: `/u/<principal typeid>`. */
const MENTION_HREF = /^\/u\/(principal_[0-9a-z]{26})$/

/** The longest name a mention query looks for (display names are short). */
export const MENTION_QUERY_MAX = 32

/** The markdown of a mention; brackets in the name are escaped so the link stays one link. */
export function mentionMarkdown(principalId: string, name: string): string {
  const label = name.replace(/[[\]\\]/g, '\\$&')
  return `[@${label}](/u/${principalId})`
}

/** The principal a link points to when it is a mention link, otherwise null. */
export function mentionTarget(href: unknown): string | null {
  if (typeof href !== 'string') return null
  return MENTION_HREF.exec(href)?.[1] ?? null
}

/**
 * Turns every mention link of a parsed document into a `mention` node (`{ id, label }`). A link only
 * counts when its text starts with `@`, so an ordinary link to a profile stays a link.
 */
export function linksToMentions(node: JSONContent): JSONContent {
  if (!Array.isArray(node.content)) return node
  return {
    ...node,
    content: node.content.map((child) => {
      if (child.type === 'text' && typeof child.text === 'string' && child.text.startsWith('@')) {
        const link = child.marks?.find((mark) => mark.type === 'link')
        const id = mentionTarget(link?.attrs?.href)
        const label = child.text.slice(1).trim()
        if (id && label) return { type: 'mention', attrs: { id, label } }
      }
      return linksToMentions(child)
    }),
  }
}

/**
 * The mention being typed at the caret: an `@` at the start of the text or after a space or an
 * opening bracket, followed by up to `MENTION_QUERY_MAX` characters without a line break, `@`, `[`
 * or `]`. Returns where the `@` is and what follows it, or null when the caret isn't in one.
 */
export function mentionQueryAt(
  text: string,
  caret: number
): { start: number; query: string } | null {
  const before = text.slice(0, caret)
  const at = before.lastIndexOf('@')
  if (at < 0) return null
  if (at > 0 && !/[\s([{]/.test(before[at - 1]!)) return null
  const query = before.slice(at + 1)
  if (query.length > MENTION_QUERY_MAX || /[\n@[\]]/.test(query)) return null
  // two spaces in a row, or a leading space, ends the mention
  if (/^\s|\s\s/.test(query)) return null
  return { start: at, query }
}

/** Replaces the typed `@query` (from `start` to the caret) with the mention and a space after it. */
export function insertMention(
  text: string,
  start: number,
  caret: number,
  principalId: string,
  name: string
): { text: string; caret: number } {
  const snippet = `${mentionMarkdown(principalId, name)} `
  const rest = text.slice(caret).replace(/^ /, '')
  return { text: text.slice(0, start) + snippet + rest, caret: start + snippet.length }
}
