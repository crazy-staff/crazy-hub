/**
 * How crazy-hub is divided (decision 13, docs/decisions.md):
 *
 * - The **project** is the main division and part of the URL (`/trainer/docs`). Ideas, roadmap,
 *   changelog, docs and downloads belong to a project; what is common to the whole hub (the start
 *   page, later news, terms, contact) sits outside the project's nav group.
 * - Projects, their sections and their **dimensions** (the trainer: game, renderer) are data, edited
 *   in the admin and carried to every page in the root route's context (`hub.projects`). Docs vary by
 *   the dimensions through a variant picker next to the docs search (#14); nothing else does.
 */
import { useRouteContext } from '@tanstack/react-router'
import {
  BookOpen,
  Download,
  Lightbulb,
  Map as MapIcon,
  ScrollText,
  type LucideIcon,
} from 'lucide-react'
import type { HubProject, SectionId } from '@/lib/shared/crazy/projects'
import { m } from '../paraglide/messages.js'
import { issues } from './issues'

export type {
  HubDimension,
  HubDimensionValue,
  HubProject,
  SectionId,
} from '@/lib/shared/crazy/projects'

/** How every section looks in the nav and on its page, whatever the project. */
export const SECTION_META: Record<
  SectionId,
  { label: () => string; description: () => string; icon: LucideIcon; issue: number }
> = {
  ideas: {
    label: m.nav_ideas,
    description: m.page_ideas_description,
    icon: Lightbulb,
    issue: issues.feedback,
  },
  roadmap: {
    label: m.nav_roadmap,
    description: m.page_roadmap_description,
    icon: MapIcon,
    issue: issues.roadmaps,
  },
  changelog: {
    label: m.nav_changelog,
    description: m.page_changelog_description,
    icon: ScrollText,
    issue: issues.changelog,
  },
  docs: {
    label: m.nav_docs,
    description: m.page_docs_description,
    icon: BookOpen,
    issue: issues.docs,
  },
  downloads: {
    label: m.nav_downloads,
    description: m.page_downloads_description,
    icon: Download,
    issue: issues.downloads,
  },
}

export const projectBySlug = (projects: readonly HubProject[], slug: string | undefined) =>
  projects.find((p) => p.slug === slug)

/** The project and section a path is in (`/trainer/docs/install` → trainer, docs). */
export function locate(
  projects: readonly HubProject[],
  pathname: string
): { project?: HubProject; section?: SectionId } {
  const [slug, section] = pathname.split('/').filter(Boolean)
  const project = projectBySlug(projects, slug)
  return { project, section: project?.sections.find((s) => s === section) }
}

/** The projects from the root route's context (loaded with the bootstrap). */
export function useProjects(): HubProject[] {
  return useRouteContext({ from: '__root__', select: (c) => c.hub.projects })
}
