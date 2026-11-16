/**
 * Flags of the UI languages (owner's note, round 6): 3:2 (12 × 8) with the buttons' squircle corners, no outline.
 * Drawn as SVG because Windows has no flag emoji. English uses the Union Jack.
 */
import { cn } from '@crazy-staff/ui'
import type { ReactNode } from 'react'
import type { Locale } from '../paraglide/runtime.js'

// every flag is drawn on a 60 × 40 (3:2) canvas
const FLAGS: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#fff" strokeWidth="8" />
      <path d="M0 0 60 40M60 0 0 40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30 0v40M0 20h60" stroke="#fff" strokeWidth="13" />
      <path d="M30 0v40M0 20h60" stroke="#C8102E" strokeWidth="8" />
    </>
  ),
  pl: (
    <>
      <rect width="60" height="20" fill="#fff" />
      <rect y="20" width="60" height="20" fill="#DC143C" />
    </>
  ),
  de: (
    <>
      <rect width="60" height="13.34" fill="#000" />
      <rect y="13.33" width="60" height="13.34" fill="#DD0000" />
      <rect y="26.66" width="60" height="13.34" fill="#FFCE00" />
    </>
  ),
  ru: (
    <>
      <rect width="60" height="13.34" fill="#fff" />
      <rect y="13.33" width="60" height="13.34" fill="#0039A6" />
      <rect y="26.66" width="60" height="13.34" fill="#D52B1E" />
    </>
  ),
}

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        // the buttons' squircle, no outline (owner's note, round 7)
        'squircle inline-flex aspect-[3/2] w-5 shrink-0 overflow-hidden rounded-[0.25rem]',
        className
      )}
    >
      <svg viewBox="0 0 60 40" preserveAspectRatio="none" className="size-full!">
        {FLAGS[locale]}
      </svg>
    </span>
  )
}
