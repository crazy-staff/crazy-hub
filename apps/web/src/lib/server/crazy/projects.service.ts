/**
 * Reads of crazy-hub's projects and dimensions (decision 13). Writes come with the admin editor.
 */
import {
  asc,
  crazyDimensions,
  crazyDimensionValues,
  crazyProjects,
  db,
  inArray,
  isNull,
  type CrazySection,
  type CrazyValueStatus,
} from '@/lib/server/db'
import type {
  HubDimension,
  HubDimensionValue,
  HubProject,
  SectionId,
  ValueStatus,
} from '@/lib/shared/crazy/projects'

// The client mirrors the schema's unions; these fail to compile when the two drift apart.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
const _sections: Same<CrazySection, SectionId> = true
const _statuses: Same<CrazyValueStatus, ValueStatus> = true
void _sections
void _statuses

export type { HubDimension, HubDimensionValue, HubProject }

/** The projects that aren't archived, in nav order, with their dimensions and values. */
export async function listHubProjects(): Promise<HubProject[]> {
  const projects = await db
    .select()
    .from(crazyProjects)
    .where(isNull(crazyProjects.archivedAt))
    .orderBy(asc(crazyProjects.position), asc(crazyProjects.name))
  if (projects.length === 0) return []

  const dimensions = await db
    .select()
    .from(crazyDimensions)
    .where(
      inArray(
        crazyDimensions.projectId,
        projects.map((p) => p.id)
      )
    )
    .orderBy(asc(crazyDimensions.position), asc(crazyDimensions.name))
  const values = dimensions.length
    ? await db
        .select()
        .from(crazyDimensionValues)
        .where(
          inArray(
            crazyDimensionValues.dimensionId,
            dimensions.map((d) => d.id)
          )
        )
        .orderBy(asc(crazyDimensionValues.position), asc(crazyDimensionValues.label))
    : []

  return projects.map((project) => ({
    id: project.id,
    slug: project.slug,
    name: project.name,
    short: project.short,
    description: project.description,
    sections: project.sections,
    dimensions: dimensions
      .filter((d) => d.projectId === project.id)
      .map((d) => ({
        slug: d.slug,
        name: d.name,
        usedInDocs: d.usedInDocs,
        defaultValue: d.defaultValue,
        values: values
          .filter((v) => v.dimensionId === d.id)
          .map((v) => ({
            slug: v.slug,
            label: v.label,
            short: v.short,
            description: v.description,
            status: v.status,
          })),
      })),
  }))
}
