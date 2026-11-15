import { describe, expect, it } from 'vitest'
import { excerpt, groupTags, parseIdeasSearch } from '../ideas'

describe('groupTags', () => {
  it('groups kind: value tags and puts plain tags last', () => {
    const groups = groupTags([
      { id: '1', name: 'game: Gothic 1' },
      { id: '2', name: 'bug' },
      { id: '3', name: 'renderer:GD3D11' },
      { id: '4', name: 'game: Gothic 2' },
    ])
    expect(groups.map((g) => [g.kind, g.tags.map((t) => t.value)])).toEqual([
      ['game', ['Gothic 1', 'Gothic 2']],
      ['renderer', ['GD3D11']],
      [null, ['bug']],
    ])
  })
})

describe('excerpt', () => {
  it('keeps short text and cuts long text at a word', () => {
    expect(excerpt('a  b\nc')).toBe('a b c')
    const long = 'word '.repeat(100)
    const cut = excerpt(long, 50)
    expect(cut.endsWith('…')).toBe(true)
    expect(cut.length).toBeLessThanOrEqual(51)
  })
  it('reads markdown as plain words', () => {
    expect(
      excerpt(
        '## What should it do?\n\nA **fast** _travel_ menu.\n\n- one\n- [two](https://x.y)\n\n![a](b.png)'
      )
    ).toBe('A fast travel menu. one two')
  })
})

describe('parseIdeasSearch', () => {
  it('keeps known values only', () => {
    expect(parseIdeasSearch({ sort: 'new', q: 'esp', status: 'open', tag: ['a', 'b'] })).toEqual({
      sort: 'new',
      q: 'esp',
      status: ['open'],
      tag: ['a', 'b'],
    })
    expect(parseIdeasSearch({ sort: 'top', q: '', status: 5 })).toEqual({})
    expect(parseIdeasSearch({ sort: 'nope' })).toEqual({})
  })
})
