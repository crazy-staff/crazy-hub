import { describe, expect, it } from 'vitest'
import {
  insertMention,
  linksToMentions,
  mentionMarkdown,
  mentionQueryAt,
  mentionTarget,
} from '../mentions'

const ID = 'principal_01kabcdefghjkmnpqrstvwxyz0'

describe('mentionMarkdown', () => {
  it('is a link to the profile with an @ name', () => {
    expect(mentionMarkdown(ID, 'Jane Doe')).toBe(`[@Jane Doe](/u/${ID})`)
  })
  it('escapes brackets in the name', () => {
    expect(mentionMarkdown(ID, 'a[b]')).toBe(`[@a\\[b\\]](/u/${ID})`)
  })
})

describe('mentionTarget', () => {
  it('reads the principal of a profile link', () => {
    expect(mentionTarget(`/u/${ID}`)).toBe(ID)
  })
  it('ignores other links', () => {
    expect(mentionTarget('https://example.com/u/' + ID)).toBeNull()
    expect(mentionTarget('/u/principal_short')).toBeNull()
    expect(mentionTarget(undefined)).toBeNull()
  })
})

describe('linksToMentions', () => {
  const link = (text: string, href: string, extra: object[] = []) => ({
    type: 'text',
    text,
    marks: [{ type: 'link', attrs: { href } }, ...extra],
  })

  it('turns mention links into mention nodes, anywhere in the tree', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hi ' },
            link('@Jane Doe', `/u/${ID}`, [{ type: 'bold' }]),
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [link('@Bob', `/u/${ID}`)] }],
            },
          ],
        },
      ],
    }
    const out = linksToMentions(doc)
    expect(out.content?.[0]?.content?.[1]).toEqual({
      type: 'mention',
      attrs: { id: ID, label: 'Jane Doe' },
    })
    expect(out.content?.[1]?.content?.[0]?.content?.[0]?.content?.[0]).toEqual({
      type: 'mention',
      attrs: { id: ID, label: 'Bob' },
    })
  })

  it('keeps ordinary links, also to profiles without an @', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [link('profile', `/u/${ID}`), link('@x', 'https://example.com')],
        },
      ],
    }
    expect(linksToMentions(doc)).toEqual(doc)
  })
})

describe('mentionQueryAt', () => {
  it('finds the @ being typed', () => {
    expect(mentionQueryAt('hello @ja', 9)).toEqual({ start: 6, query: 'ja' })
    expect(mentionQueryAt('@', 1)).toEqual({ start: 0, query: '' })
    expect(mentionQueryAt('(@Jane D', 8)).toEqual({ start: 1, query: 'Jane D' })
  })
  it('ignores emails, finished lines and finished mentions', () => {
    expect(mentionQueryAt('mail me@ex', 10)).toBeNull()
    expect(mentionQueryAt('@ja\nnext', 8)).toBeNull()
    expect(mentionQueryAt(`[@Jane](/u/${ID}) ok`, 20)).toBeNull()
    expect(mentionQueryAt('@ ja', 4)).toBeNull()
    expect(mentionQueryAt('@jane  doe', 10)).toBeNull()
  })
})

describe('insertMention', () => {
  it('replaces the query with the mention and a space', () => {
    const out = insertMention('hi @ja there', 3, 6, ID, 'Jane')
    expect(out.text).toBe(`hi [@Jane](/u/${ID}) there`)
    expect(out.caret).toBe(`hi [@Jane](/u/${ID}) `.length)
  })
})
