import { describe, expect, it } from 'vitest'
import { applyVote, ideaScore } from '../votes'

describe('applyVote', () => {
  it('casts, takes back and switches a vote', () => {
    expect(applyVote(null, 'up')).toEqual({ next: 'up', delta: 1 })
    expect(applyVote(null, 'down')).toEqual({ next: 'down', delta: -1 })
    expect(applyVote('up', 'up')).toEqual({ next: null, delta: -1 })
    expect(applyVote('down', 'down')).toEqual({ next: null, delta: 1 })
    // a downvote replaces the upvote (and the other way round)
    expect(applyVote('up', 'down')).toEqual({ next: 'down', delta: -2 })
    expect(applyVote('down', 'up')).toEqual({ next: 'up', delta: 2 })
  })
})

describe('ideaScore', () => {
  it('is upvotes minus downvotes and may go below zero', () => {
    expect(ideaScore(5, 2)).toBe(3)
    expect(ideaScore(0, 3)).toBe(-3)
  })
})
