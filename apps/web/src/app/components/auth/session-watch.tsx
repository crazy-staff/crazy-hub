/**
 * Opens "sign in again" when the session of the person this page was rendered for has ended (#5).
 * It reacts to `reportSessionExpired` (a failed change or query) and checks the session itself when
 * the tab comes back into view (at most once a minute). The sign-in dialog then opens over the same
 * page with the person's e-mail filled in; the page stays mounted, so drafts are kept. Visitors who
 * were never signed in are left alone.
 */
import { useNavigate, useRouteContext } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { authClient } from '@/lib/client/auth-client'
import {
  clearSessionExpired,
  rememberSessionEmail,
  reportSessionExpired,
  useSessionExpired,
} from '../../lib/session'

const CHECK_EVERY_MS = 60_000

/** The search that opens the sign-in dialog as "sign in again". */
export const openSignInAgain = ((prev: Record<string, unknown>) => ({
  ...prev,
  auth: 'signin',
  again: 1,
})) as never

export function SessionWatch() {
  const navigate = useNavigate()
  const signedIn = useRouteContext({ from: '__root__', select: (c) => !!c.hub.me })
  const email = useRouteContext({ from: '__root__', select: (c) => c.session?.user?.email ?? '' })
  if (signedIn && email) rememberSessionEmail(email)
  const expired = useSessionExpired()
  const lastCheck = useRef(0)

  useEffect(() => {
    if (!expired) return
    // a visitor's refused request isn't an ended session
    if (!signedIn) return clearSessionExpired()
    void navigate({ to: '.', search: openSignInAgain, replace: true, resetScroll: false })
  }, [expired, signedIn, navigate])

  useEffect(() => {
    if (!signedIn) return
    const check = async () => {
      if (document.visibilityState !== 'visible') return
      const now = Date.now()
      if (now - lastCheck.current < CHECK_EVERY_MS) return
      lastCheck.current = now
      try {
        const result = await authClient.getSession()
        // only a clear "no session" counts; a network hiccup is not a sign-out
        if (!result.error && !result.data) reportSessionExpired()
      } catch {
        // offline: try again next time
      }
    }
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [signedIn])

  return null
}
