import { Button, DropdownMenu } from '@crazy-staff/ui'
import { AnimatePresence, motion } from 'motion/react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { m } from '../paraglide/messages.js'

const THEMES = [
  { value: 'light', icon: Sun, label: m.theme_light },
  { value: 'dark', icon: Moon, label: m.theme_dark },
  { value: 'system', icon: Monitor, label: m.theme_system },
] as const

/**
 * The theme menu (owner's note, round 4): like the language menu, a dropdown with light, dark and
 * system instead of an instant toggle. The trigger shows the theme in use; its icon turns as it swaps.
 */
export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const dark = mounted && resolvedTheme === 'dark'
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={m.theme()}
            title={m.theme()}
            className="text-muted hover:text-foreground"
          />
        }
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={dark ? 'moon' : 'sun'}
            initial={{ rotate: -90, scale: 0.6, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0.6, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex"
          >
            {dark ? <Moon /> : <Sun />}
          </motion.span>
        </AnimatePresence>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="end" className="min-w-40">
        <DropdownMenu.Group>
          <DropdownMenu.GroupLabel>{m.theme()}</DropdownMenu.GroupLabel>
          <DropdownMenu.RadioGroup
            value={mounted ? (theme ?? 'system') : undefined}
            onValueChange={(value) => setTheme(String(value))}
          >
            {THEMES.map((option) => (
              <DropdownMenu.RadioItem key={option.value} value={option.value}>
                <option.icon /> {option.label()}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
