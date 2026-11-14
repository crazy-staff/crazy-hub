import type { HubProject } from '@/lib/shared/crazy/projects'

/** The trainer as the migration seeds it. */
export const trainer: HubProject = {
  id: 'p-trainer',
  slug: 'trainer',
  name: 'Crazy Gothic Trainer',
  short: 'GT',
  description: 'In-game trainer for Gothic',
  sections: ['ideas', 'roadmap', 'changelog', 'docs', 'downloads'],
  boards: [{ id: 'b-ideas', slug: 'ideas', name: 'Ideas' }],
  dimensions: [
    {
      slug: 'game',
      name: 'Game',
      usedInDocs: true,
      defaultValue: 'gothic-1',
      values: [
        { slug: 'gothic-1', label: 'Gothic 1', short: 'G1', description: '', status: 'available' },
        { slug: 'gothic-2', label: 'Gothic 2', short: 'G2', description: '', status: 'planned' },
      ],
    },
  ],
}

export const other: HubProject = {
  ...trainer,
  id: 'p-other',
  slug: 'other',
  name: 'Other',
  sections: ['ideas', 'changelog'],
  dimensions: [],
}
