import { House, type LucideIcon } from 'lucide-react'
import type { HubProject } from '@/lib/shared/crazy/projects'
import { m } from '../paraglide/messages.js'

/** Rows common to the whole hub, above the project picker. */
export const COMMON: { to: '/'; label: () => string; icon: LucideIcon }[] = [
  { to: '/', label: m.nav_home, icon: House },
]

/** The path of a project's section. */
export const sectionPath = (project: Pick<HubProject, 'slug'>, section: string) =>
  `/${project.slug}/${section}`

/** Every nav row in sidebar order; the order also decides the direction of page transitions. */
function navOrder(projects: readonly HubProject[]) {
  return [
    ...COMMON.map((item) => item.to as string),
    ...projects.flatMap((project) => project.sections.map((s) => sectionPath(project, s))),
  ]
}

/** The nav row a path belongs to (a page under /trainer/docs/… belongs to Docs). */
export function navItemOf(projects: readonly HubProject[], pathname: string): string | undefined {
  return navOrder(projects)
    .filter((to) =>
      to === '/' ? pathname === '/' : pathname === to || pathname.startsWith(`${to}/`)
    )
    .sort((a, b) => b.length - a.length)[0]
}

/** Position of a path in the sidebar, for the direction a page comes in from. */
export function navPosition(projects: readonly HubProject[], pathname: string): number {
  const order = navOrder(projects)
  const item = navItemOf(projects, pathname)
  return item ? order.indexOf(item) : order.length
}
