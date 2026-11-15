/**
 * Round flags of the UI languages (owner's note, round 6). Drawn as SVG: Windows has no flag emoji.
 * English uses the Union Jack.
 */
import { cn } from '@crazy-staff/ui'
import type { ReactNode } from 'react'
import type { Locale } from '../paraglide/runtime.js'

const FLAGS: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="60" height="60" fill="#012169" />
      <path d="M0 0 60 60M60 0 0 60" stroke="#fff" strokeWidth="12" />
      <path d="M0 0 60 60M60 0 0 60" stroke="#C8102E" strokeWidth="4" />
      <path d="M30 0v60M0 30h60" stroke="#fff" strokeWidth="18" />
      <path d="M30 0v60M0 30h60" stroke="#C8102E" strokeWidth="10" />
    </>
  ),
  pl: (
    <>
      <rect width="60" height="30" fill="#fff" />
      <rect y="30" width="60" height="30" fill="#DC143C" />
    </>
  ),
  de: (
    <>
      <rect width="60" height="20" fill="#000" />
      <rect y="20" width="60" height="20" fill="#DD0000" />
      <rect y="40" width="60" height="20" fill="#FFCE00" />
    </>
  ),
  ru: (
    <>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#0039A6" />
      <rect y="40" width="60" height="20" fill="#D52B1E" />
    </>
  ),
}

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <svg
      viewBox="0 0 60 60"
      aria-hidden
      className={cn(
        // a hairline ring keeps white stripes visible on a light surface
        'size-4.5 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/15',
        className
      )}
    >
      <clipPath id={`flag-${locale}`}>
        <circle cx="30" cy="30" r="30" />
      </clipPath>
      <g clipPath={`url(#flag-${locale})`}>{FLAGS[locale]}</g>
    </svg>
  )
}
