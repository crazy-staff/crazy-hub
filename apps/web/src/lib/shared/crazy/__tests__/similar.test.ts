import { describe, expect, it } from 'vitest'
import { similarTsQuery } from '../similar'

describe('similarTsQuery', () => {
  it('matches any word of the title as a prefix', () => {
    expect(similarTsQuery('Slack notifications!')).toBe('slack:* | notifications:*')
  })
  it('drops short words, repeats and characters a query would choke on', () => {
    expect(similarTsQuery("ESP: an 'X' & map, map")).toBe('esp:* | map:*')
    expect(similarTsQuery('Zürich teleport')).toBe('zurich:* | teleport:*')
  })
  it('is null without usable words', () => {
    expect(similarTsQuery('a b !')).toBeNull()
  })
})
