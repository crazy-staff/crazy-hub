import { describe, expect, it } from 'vitest'
import { navItemOf, navPosition } from '../nav'
import { locate, projectBySlug } from '../projects'
import { other, trainer } from './fixtures'

const projects = [trainer, other]

describe('locate', () => {
  it('finds a project and section from the path', () => {
    expect(locate(projects, '/trainer/docs/install')).toEqual({ project: trainer, section: 'docs' })
    expect(locate(projects, '/trainer')).toEqual({ project: trainer, section: undefined })
    expect(locate(projects, '/other/docs')).toEqual({ project: other, section: undefined })
    expect(locate(projects, '/')).toEqual({ project: undefined, section: undefined })
    expect(projectBySlug(projects, 'nope')).toBeUndefined()
  })
})

describe('navItemOf', () => {
  it('matches the start page only on /', () => {
    expect(navItemOf(projects, '/')).toBe('/')
    expect(navItemOf(projects, '/trainer/roadmap')).toBe('/trainer/roadmap')
  })

  it('keeps a nested page under its section', () => {
    expect(navItemOf(projects, '/trainer/docs/getting-started/install')).toBe('/trainer/docs')
  })

  it('does not match a path that only shares a prefix or a disabled section', () => {
    expect(navItemOf(projects, '/trainer/docsearch')).toBeUndefined()
    expect(navItemOf(projects, '/other/docs')).toBeUndefined()
    expect(navItemOf(projects, '/admin')).toBeUndefined()
  })
})

describe('navPosition', () => {
  it('follows the order of the sidebar', () => {
    expect(navPosition(projects, '/')).toBe(0)
    expect(navPosition(projects, '/trainer/ideas')).toBe(1)
    expect(navPosition(projects, '/trainer/downloads')).toBeGreaterThan(
      navPosition(projects, '/trainer/docs')
    )
    expect(navPosition(projects, '/other/ideas')).toBeGreaterThan(
      navPosition(projects, '/trainer/downloads')
    )
  })

  it('puts pages outside the sidebar after it', () => {
    expect(navPosition(projects, '/admin')).toBeGreaterThan(
      navPosition(projects, '/other/changelog')
    )
  })
})
