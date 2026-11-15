/**
 * Content that replaces a skeleton fades and rises in a little slower than a page change, so the swap
 * from placeholder to content doesn't flash (owner's note, 2026-11-15). Respects reduced motion.
 */
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import { EASE } from './page'

export function Appear({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 8, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      {children}
    </motion.div>
  )
}
