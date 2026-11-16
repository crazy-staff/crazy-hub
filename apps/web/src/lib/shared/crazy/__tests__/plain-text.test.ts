import { describe, expect, it } from 'vitest'
import { plainText } from '../plain-text'

describe('plainText', () => {
  it('drops markdown marks and keeps the words', () => {
    expect(plainText('Could it remember **which world** (Colony / _Old Mine_)?')).toBe(
      'Could it remember which world (Colony / Old Mine)?'
    )
    expect(plainText('## Title\n- one\n> quote `code` [link](https://x.y) ![img](a.png)')).toBe(
      'Title\none\nquote code link  '
    )
  })

  it('leaves snake_case and lone asterisks alone', () => {
    expect(plainText('use save_position and 2 * 3')).toBe('use save_position and 2 * 3')
  })
})
