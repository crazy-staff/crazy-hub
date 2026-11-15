/**
 * The shape of a crazy-hub project as every page sees it (decision 13): the hub's main division,
 * with its enabled sections and its dimensions (the trainer: game, renderer). Read on the server by
 * `lib/server/crazy/projects.service.ts`, carried to the client in the root route's context.
 */

/** Mirrors `CRAZY_SECTIONS` / `CRAZY_VALUE_STATUSES` of the schema (checked in projects.service.ts). */
export const SECTION_IDS = ['ideas', 'roadmap', 'changelog', 'docs', 'downloads'] as const
export type SectionId = (typeof SECTION_IDS)[number]
export type ValueStatus = 'available' | 'planned' | 'later'

export interface HubDimensionValue {
  slug: string
  label: string
  /** Two letters for the badge. */
  short: string
  description: string
  status: ValueStatus
}

export interface HubDimension {
  slug: string
  name: string
  /** Docs vary by it (a group in the docs variant picker); otherwise a tag kind only. */
  usedInDocs: boolean
  defaultValue: string | null
  values: HubDimensionValue[]
}

export interface HubProject {
  id: string
  /** The URL segment: `/trainer/…`. */
  slug: string
  name: string
  /** Two letters for the badge. */
  short: string
  description: string
  /** Enabled sections, in nav order. */
  sections: SectionId[]
  dimensions: HubDimension[]
  /** The project's Quackback boards (its ideas are their posts), by name. */
  boards: { id: string; slug: string; name: string }[]
}
