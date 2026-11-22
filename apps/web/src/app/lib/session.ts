/**
 * Noticing that the session ended while a page is open (#5, "sign in again"). A change that fails
 * because nobody is signed in any more, a query that does, or a check when the tab comes back into
 * view reports it here; `SessionWatch` then opens the sign-in dialog in its "sign in again" form
 * over the same page, so nothing typed on it is lost.
 */
import { useSyncExternalStore } from 'react'

/** Server errors that mean the request had no valid session (Quackback's and ours). */
const SESSION_ERRORS = [
  'Authentication required',
  'Not authenticated',
  'UNAUTHORIZED',
  'Unauthorized',
]

export function isSessionError(err: unknown): boolean {
  const text = err instanceof Error ? err.message : typeof err === 'string' ? err : ''
  const status = (err as { status?: unknown; statusCode?: unknown } | null)?.status
  return status === 401 || SESSION_ERRORS.some((message) => text.includes(message))
}

let expired = false
// the e-mail of the person whose session ended, for "sign in again" (the page may already show the
// signed-out state by the time the dialog renders)
let endedEmail = ''

export function rememberSessionEmail(email: string) {
  endedEmail = email
}

export function sessionEmail(): string {
  return endedEmail
}
const listeners = new Set<() => void>()
const emit = () => listeners.forEach((listener) => listener())

/** The session ended (seen by a failed request or a check); the watch decides what to show. */
export function reportSessionExpired() {
  // the server renders many people's pages: the flag is only ever a browser's
  if (typeof window === 'undefined' || expired) return
  expired = true
  emit()
}

/** Reports `err` when it means the session ended; returns whether it did. */
export function noticeSessionError(err: unknown): boolean {
  if (!isSessionError(err)) return false
  reportSessionExpired()
  return true
}

/** Back to normal: a sign-in finished or the dialog was handled. */
export function clearSessionExpired() {
  if (!expired) return
  expired = false
  emit()
}

export function useSessionExpired(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => expired,
    () => false
  )
}
