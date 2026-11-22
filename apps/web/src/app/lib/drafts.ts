/**
 * Unsent text kept in the tab's session storage (#5, "sign in again"): a comment or an edit survives
 * the session ending (the page re-renders signed out and the composer goes away), a sign-in through
 * an identity provider (a full page load) and an accidental reload. Cleared once sent or cancelled.
 * Without storage (private mode, blocked) it is plain component state.
 */
import { useCallback, useEffect, useState } from 'react'

const PREFIX = 'crazy-hub:draft:'

function store(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

export function readDraft<T>(key: string): T | null {
  try {
    const raw = store()?.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

/** Keeps `value`, or forgets the draft with `null`. */
export function writeDraft(key: string, value: unknown) {
  try {
    if (value === null) store()?.removeItem(PREFIX + key)
    else store()?.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // full or blocked storage: the draft lives in the component only
  }
}

/**
 * A form's value that outlives the component (text, or a small object of fields). `initial` is used
 * when nothing is kept (an edit starts from the saved text), and a value equal to it keeps nothing.
 * The kept draft is read after mounting, so the server render and the first client render agree.
 */
export function useDraft<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial)
  const initialJson = JSON.stringify(initial)
  useEffect(() => {
    const kept = readDraft<T>(key)
    if (kept !== null) setValue(kept)
  }, [key])
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        writeDraft(key, JSON.stringify(resolved) === initialJson ? null : resolved)
        return resolved
      })
    },
    [key, initialJson]
  )
  const clear = useCallback(() => {
    writeDraft(key, null)
    setValue(JSON.parse(initialJson) as T)
  }, [key, initialJson])
  return [value, set, clear] as const
}
