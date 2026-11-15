/** Helpers of the step-by-step idea / problem form (#5). */
import type { TagLike } from './ideas'

export type IdeaKind = 'idea' | 'problem'

export interface ProblemFields {
  happened: string
  steps: string
  expected: string
}

/** The parts of an idea (#34): what it does (required), how it works, why it helps. */
export interface IdeaFields {
  what: string
  how: string
  why: string
}

/** Headings written into the stored text; English, like the rest of the content on GitHub. */
export const PROBLEM_HEADINGS: Record<keyof ProblemFields, string> = {
  happened: 'What happened',
  steps: 'Steps to reproduce',
  expected: 'Expected',
}

export const IDEA_HEADINGS: Record<keyof IdeaFields, string> = {
  what: 'What should it do?',
  how: 'How should it work?',
  why: 'Why is it useful?',
}

/** Filled fields as `## Heading` sections, in the order of `headings`. */
function compose<T extends string>(fields: Record<T, string>, headings: Record<T, string>) {
  return (Object.keys(headings) as T[])
    .filter((key) => fields[key].trim())
    .map((key) => `## ${headings[key]}\n\n${fields[key].trim()}`)
}

/** A problem report as one markdown text with a heading per field (empty fields are left out). */
export function composeProblem(fields: ProblemFields, version: string): string {
  const parts = compose(fields, PROBLEM_HEADINGS)
  if (version.trim()) parts.push(`**Trainer version:** ${version.trim()}`)
  return parts.join('\n\n')
}

/** An idea as one markdown text with a heading per field (empty fields are left out). */
export function composeIdea(fields: IdeaFields): string {
  return compose(fields, IDEA_HEADINGS).join('\n\n')
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
