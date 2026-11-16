/**
 * Picking one of a few options in a form (settings: language, theme). A segmented toggle where
 * there is room; on a phone a full-width button with the current option that opens a drawer of
 * large rows (owner's note, round 7: the toggle ran off the screen).
 */
import { Button, ToggleGroup } from '@crazy-staff/ui'
import { ChevronDown } from 'lucide-react'
import { usePhone } from '../lib/use-phone'
import { AdaptiveMenu } from './adaptive'
import type { Choice } from './choice-menu'

export function ChoiceField({
  title,
  value,
  onValueChange,
  choices,
}: {
  title: string
  value: string | undefined
  onValueChange: (value: string) => void
  choices: Choice[]
}) {
  const phone = usePhone()
  if (phone) {
    const current = choices.find((choice) => choice.value === value)
    return (
      <AdaptiveMenu
        title={title}
        trigger={
          <Button
            variant="outline"
            size="lg"
            className="w-full justify-start gap-3"
            aria-label={title}
          >
            {current?.icon}
            <span className="flex-1 text-start" lang={current?.lang}>
              {current?.label}
            </span>
            <ChevronDown className="text-muted" />
          </Button>
        }
        entries={choices.map((choice) => ({
          label: choice.label,
          icon: choice.icon,
          lang: choice.lang,
          checked: choice.value === value,
          onSelect: () => onValueChange(choice.value),
        }))}
      />
    )
  }
  return (
    <ToggleGroup
      aria-label={title}
      value={value ? [value] : []}
      onValueChange={(next) => next[0] && onValueChange(String(next[0]))}
      items={choices.map((choice) => ({
        value: choice.value,
        label: (
          <span className="flex items-center gap-2" lang={choice.lang}>
            {choice.icon} {choice.label}
          </span>
        ),
      }))}
    />
  )
}
