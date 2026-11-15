import { useEffect, useState } from 'react'

/**
 * `value`, settled: it changes only after `delay` ms without a new value. Search fields use it so a
 * query runs once the person stops typing, not on every key (owner's note, round 4: with hundreds
 * of people a request per key gets slow).
 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return settled
}
