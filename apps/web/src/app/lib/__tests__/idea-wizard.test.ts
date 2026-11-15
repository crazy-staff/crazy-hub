import { describe, expect, it } from 'vitest'
import { composeIdea, composeProblem, matchTag } from '../idea-wizard'

describe('composeProblem', () => {
  it('writes a heading per filled field and the version', () => {
    expect(composeProblem({ happened: 'It crashed', steps: '', expected: 'No crash' }, '1.2')).toBe(
      '## What happened\n\nIt crashed\n\n## Expected\n\nNo crash\n\n**Trainer version:** 1.2'
    )
    expect(composeProblem({ happened: '', steps: '', expected: '' }, '')).toBe('')
  })
})

describe('composeIdea', () => {
  it('writes a heading per filled field', () => {
    expect(composeIdea({ what: 'A map', how: '', why: 'Saves time' })).toBe(
      '## What should it do?\n\nA map\n\n## Why is it useful?\n\nSaves time'
    )
    expect(composeIdea({ what: ' ', how: '', why: '' })).toBe('')
  })
})

describe('matchTag', () => {
  const tags = [
    { id: '1', name: 'type: bug' },
    { id: '2', name: 'game:Gothic 1' },
    { id: '3', name: 'Category: Arena' },
  ]
  it('finds kind: value tags whatever the case and spacing', () => {
    expect(matchTag(tags, 'type', 'bug')).toBe('1')
    expect(matchTag(tags, 'game', 'Gothic  1')).toBe('2')
    expect(matchTag(tags, 'category', 'arena')).toBe('3')
    expect(matchTag(tags, 'type', 'idea')).toBeUndefined()
  })
})
