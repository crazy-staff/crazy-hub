import { createFileRoute, notFound, Outlet } from '@tanstack/react-router'
import { projectBySlug } from '../../lib/projects'

/** A project's part of the hub (`/trainer/…`); an unknown or archived project is a 404. */
export const Route = createFileRoute('/_app/$project')({
  beforeLoad: ({ context, params }) => {
    const project = projectBySlug(context.hub.projects, params.project)
    if (!project) throw notFound()
    return { project }
  },
  component: Outlet,
})
