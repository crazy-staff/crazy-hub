// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import {
  clearSessionExpired,
  isSessionError,
  noticeSessionError,
  useSessionExpired,
} from '../session'

describe('isSessionError', () => {
  it('knows the errors of a request without a session', () => {
    expect(isSessionError(new Error('Authentication required'))).toBe(true)
    expect(isSessionError(new Error('UNAUTHORIZED: session expired'))).toBe(true)
    expect(isSessionError({ status: 401 })).toBe(true)
  })
  it('leaves other errors alone', () => {
    expect(isSessionError(new Error("Access denied: Requires crazy-hub permission 'x'"))).toBe(
      false
    )
    expect(isSessionError(new Error('slug-taken'))).toBe(false)
    expect(isSessionError(null)).toBe(false)
  })
})

describe('session expiry flag', () => {
  it('is raised by a session error and cleared after signing in', () => {
    const { result } = renderHook(() => useSessionExpired())
    expect(result.current).toBe(false)
    act(() => void noticeSessionError(new Error('slug-taken')))
    expect(result.current).toBe(false)
    act(() => void noticeSessionError(new Error('Authentication required')))
    expect(result.current).toBe(true)
    act(() => clearSessionExpired())
    expect(result.current).toBe(false)
  })
})
