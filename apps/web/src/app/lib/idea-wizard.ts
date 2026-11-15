/** Helpers of the step-by-step idea / problem form (#5). */
import type { TagLike } from './ideas'

export type IdeaKind = 'idea' | 'problem'

export interface ProblemFields {
  happened: string
  steps: string
  expected: string
}

/** A problem report as one markdown text with a heading per field (empty fields are left out). */
export function composeProblem(fields: ProblemFields, version: string): string {
  const parts = [
    ['What happened', fields.happened],
    ['Steps to reproduce', fields.steps],
    ['Expected', fields.expected],
  ]
    .filter(([, text]) => text.trim())
    .map(([heading, text]) => `## ${heading}\n\n${text.trim()}`)
  if (version.trim()) parts.push(`**Trainer version:** ${version.trim()}`)
  return parts.join('\n\n')
}

/** The id of the `kind: value` tag (case and spacing ignored), if the workspace has it. */
export function matchTag(
  tags: readonly TagLike[],
  kind: string,
  value: string
): string | undefined {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  const wanted = `${norm(kind)}: ${norm(value)}`
  return tags.find((t) => norm(t.name.replace(/:\s*/, ': ')) === wanted)?.id
}
