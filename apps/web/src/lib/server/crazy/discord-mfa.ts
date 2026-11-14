/**
 * Whether a user's linked Discord account has 2FA (decision 13): team and tester roles need it, so the
 * hub enforces 2FA through Discord instead of its own.
 *
 * The answer comes from Discord's `GET /users/@me` (`mfa_enabled`, available with the `identify` scope
 * Better Auth's Discord provider asks for) and is cached in `crazy_discord_mfa`. It is checked again
 * when a role is given, after every Discord sign-in (Better Auth rewrites the account row's tokens, so
 * `account.updated_at` moves past the cached `account_updated_at`) and at least once a day. Unlinking
 * Discord removes the account row, which suspends the roles at once.
 */
import type { UserId } from '@quackback/ids'
import { account, and, crazyDiscordMfa, db, eq } from '@/lib/server/db'
import { logger } from '@/lib/server/logger'
import type { DiscordStatus } from '@/lib/shared/crazy/roles'

const log = logger.child({ component: 'crazy-discord-mfa' })

export const DISCORD_RECHECK_MS = 24 * 60 * 60 * 1000

export interface DiscordAccountRow {
  accountId: string
  updatedAt: Date
}

export interface DiscordMfaRow {
  discordAccountId: string
  mfaEnabled: boolean
  checkedAt: Date
  accountUpdatedAt: Date | null
}

export function discordStatusFrom(
  discordAccount: DiscordAccountRow | null,
  cached: DiscordMfaRow | null
): DiscordStatus {
  if (!discordAccount) return 'no-discord'
  if (!cached || cached.discordAccountId !== discordAccount.accountId) return 'unknown'
  return cached.mfaEnabled ? 'ok' : 'no-mfa'
}

export function needsDiscordRecheck(
  discordAccount: DiscordAccountRow | null,
  cached: DiscordMfaRow | null,
  now: Date = new Date()
): boolean {
  if (!discordAccount) return false
  if (!cached || cached.discordAccountId !== discordAccount.accountId) return true
  if (cached.accountUpdatedAt && discordAccount.updatedAt > cached.accountUpdatedAt) return true
  return now.getTime() - cached.checkedAt.getTime() > DISCORD_RECHECK_MS
}

async function readRows(userId: UserId) {
  const [[discordAccount], [cached]] = await Promise.all([
    db
      .select({ id: account.id, accountId: account.accountId, updatedAt: account.updatedAt })
      .from(account)
      .where(and(eq(account.userId, userId), eq(account.providerId, 'discord')))
      .limit(1),
    db.select().from(crazyDiscordMfa).where(eq(crazyDiscordMfa.userId, userId)).limit(1),
  ])
  return { discordAccount: discordAccount ?? null, cached: cached ?? null }
}

/** The cached status, plus whether it is due for a fresh check. */
export async function readDiscordStatus(userId: UserId) {
  const { discordAccount, cached } = await readRows(userId)
  return {
    status: discordStatusFrom(discordAccount, cached),
    stale: needsDiscordRecheck(discordAccount, cached),
  }
}

export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<{
  ok: boolean
  status: number
  json(): Promise<unknown>
}>

/** The Discord access token of the account row (`account.id`), refreshed by Better Auth if expired. */
async function discordAccessToken(userId: UserId, accountRowId: string): Promise<string | null> {
  const { getAuth } = await import('@/lib/server/auth')
  const auth = await getAuth()
  const result = (await auth.api.getAccessToken({
    body: { accountId: accountRowId, userId },
  })) as { accessToken?: string } | null
  return result?.accessToken ?? null
}

/**
 * Asks Discord again and stores the answer. Returns the new status; on a failed call the stored
 * answer is kept and its status returned (a Discord outage never suspends anyone by itself).
 */
export async function refreshDiscordStatus(
  userId: UserId,
  deps: {
    fetch?: FetchLike
    accessToken?: (userId: UserId, accountRowId: string) => Promise<string | null>
  } = {}
): Promise<DiscordStatus> {
  const { discordAccount, cached } = await readRows(userId)
  if (!discordAccount) return 'no-discord'
  try {
    const token = await (deps.accessToken ?? discordAccessToken)(userId, discordAccount.id)
    if (!token) throw new Error('no Discord access token')
    const response = await (deps.fetch ?? (fetch as unknown as FetchLike))(
      'https://discord.com/api/v10/users/@me',
      { headers: { Authorization: `Bearer ${token}` } }
    )
    if (!response.ok) throw new Error(`Discord answered ${response.status}`)
    const body = (await response.json()) as { id?: string; mfa_enabled?: boolean }
    const row = {
      userId,
      discordAccountId: discordAccount.accountId,
      mfaEnabled: body.mfa_enabled === true,
      checkedAt: new Date(),
      accountUpdatedAt: discordAccount.updatedAt,
    }
    await db
      .insert(crazyDiscordMfa)
      .values(row)
      .onConflictDoUpdate({ target: crazyDiscordMfa.userId, set: row })
    return row.mfaEnabled ? 'ok' : 'no-mfa'
  } catch (err) {
    log.warn({ err, user_id: userId }, 'Discord 2FA check failed')
    return discordStatusFrom(discordAccount, cached)
  }
}
