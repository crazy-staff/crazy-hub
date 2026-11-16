import { useEffect, useState } from 'react'

/** Below Tailwind's `sm` (640px): small menus and popovers open as drawers there (round 7). */
const PHONE = '(max-width: 639px)'

/** True on a phone-sized window; false on the server and until measured. */
export function usePhone() {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(PHONE)
    const update = () => setPhone(query.matches)
    update()
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}
