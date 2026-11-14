import { createFileRoute, notFound } from '@tanstack/react-router'
import { SECTION_META } from '../../../lib/projects'
import { SectionPage } from '../../../components/section-page'

/**
 * Placeholder for every project section until its own route lands with its issue (a file route such as
 * `$project/docs.tsx` then takes precedence over this one). A section the project hasn't enabled is a
 * 404.
 */
export const Route = createFileRoute('/_app/$project/$section')({
  beforeLoad: ({ context, params }) => {
    const section = context.project.sections.find((s) => s === params.section)
    if (!section) throw notFound()
    return { section }
  },
  head: ({ match }) => ({
    meta: [
      { title: `${SECTION_META[match.context.section].label()} · ${match.context.project.name}` },
    ],
  }),
  component: () => <SectionPage section={Route.useRouteContext({ select: (c) => c.section })} />,
})
