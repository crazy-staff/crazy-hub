import { createFileRoute, notFound, redirect } from '@tanstack/react-router'

/** A project's start is its first enabled section. */
export const Route = createFileRoute('/_app/$project/')({
  beforeLoad: ({ context }) => {
    const [first] = context.project.sections
    if (!first) throw notFound()
    throw redirect({
      to: '/$project/$section',
      params: { project: context.project.slug, section: first },
      replace: true,
    })
  },
})
