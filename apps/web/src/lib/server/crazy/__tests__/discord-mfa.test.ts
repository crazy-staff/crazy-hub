import { describe, expect, it } from 'vitest'
import { DISCORD_RECHECK_MS, discordStatusFrom, needsDiscordRecheck } from '../discord-mfa'

const account = { accountId: '123', updatedAt: new Date('2026-11-14T10:00:00Z') }
const cached = {
  discordAccountId: '123',
  mfaEnabled: true,
  checkedAt: new Date('2026-11-14T10:00:00Z'),
  accountUpdatedAt: new Date('2026-11-14T10:00:00Z'),
}

describe('discordStatusFrom', () => {
  it('reads the cached answer for the linked account', () => {
    expect(discordStatusFrom(null, cached)).toBe('no-discord')
    expect(discordStatusFrom(account, null)).toBe('unknown')
    expect(discordStatusFrom(account, cached)).toBe('ok')
    expect(discordStatusFrom(account, { ...cached, mfaEnabled: false })).toBe('no-mfa')
  })

  it('ignores an answer for another Discord account', () => {
    expect(discordStatusFrom({ ...account, accountId: '456' }, cached)).toBe('unknown')
  })
})

describe('needsDiscordRecheck', () => {
  const now = new Date('2026-11-14T12:00:00Z')

  it('re-checks after a new Discord sign-in', () => {
    expect(needsDiscordRecheck(account, cached, now)).toBe(false)
    const signedInAgain = { ...account, updatedAt: new Date('2026-11-14T11:00:00Z') }
    expect(needsDiscordRecheck(signedInAgain, cached, now)).toBe(true)
  })

  it('re-checks a day-old answer, a missing one and one for another account', () => {
    const later = new Date(cached.checkedAt.getTime() + DISCORD_RECHECK_MS + 1)
    expect(needsDiscordRecheck(account, cached, later)).toBe(true)
    expect(needsDiscordRecheck(account, null, now)).toBe(true)
    expect(needsDiscordRecheck({ ...account, accountId: '456' }, cached, now)).toBe(true)
  })

  it('has nothing to check without a Discord account', () => {
    expect(needsDiscordRecheck(null, null, now)).toBe(false)
  })
})
