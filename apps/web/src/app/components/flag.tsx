/**
 * Flags of the UI languages (owner's note, round 6): 16:9 with the buttons' squircle corners.
 * Drawn as SVG because Windows has no flag emoji. English uses the Union Jack.
 */
import { cn } from '@crazy-staff/ui'
import type { ReactNode } from 'react'
import type { Locale } from '../paraglide/runtime.js'

// every flag is drawn on a 64 × 36 (16:9) canvas
const FLAGS: Record<Locale, ReactNode> = {
  en: (
    <>
      <rect width="64" height="36" fill="#012169" />
      <path d="M0 0 64 36M64 0 0 36" stroke="#fff" strokeWidth="7" />
      <path d="M0 0 64 36M64 0 0 36" stroke="#C8102E" strokeWidth="2.5" />
      <path d="M32 0v36M0 18h64" stroke="#fff" strokeWidth="12" />
      <path d="M32 0v36M0 18h64" stroke="#C8102E" strokeWidth="7" />
    </>
  ),
  pl: (
    <>
      <rect width="64" height="18" fill="#fff" />
      <rect y="18" width="64" height="18" fill="#DC143C" />
    </>
  ),
  de: (
    <>
      <rect width="64" height="12" fill="#000" />
      <rect y="12" width="64" height="12" fill="#DD0000" />
      <rect y="24" width="64" height="12" fill="#FFCE00" />
    </>
  ),
  ru: (
    <>
      <rect width="64" height="12" fill="#fff" />
      <rect y="12" width="64" height="12" fill="#0039A6" />
      <rect y="24" width="64" height="12" fill="#D52B1E" />
    </>
  ),
}

export function Flag({ locale, className }: { locale: Locale; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        // the buttons' squircle; a hairline ring keeps white stripes visible on a light surface
        'squircle inline-flex aspect-video w-5.5 shrink-0 overflow-hidden rounded-[0.25rem] ring-1 ring-black/10 dark:ring-white/15',
        className
      )}
    >
      <svg viewBox="0 0 64 36" preserveAspectRatio="none" className="size-full!">
        {FLAGS[locale]}
      </svg>
    </span>
  )
}
