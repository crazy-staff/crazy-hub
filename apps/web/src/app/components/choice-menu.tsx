/**
 * A menu to pick one of a few options (language, theme): a title with room under it, then the
 * options with their icon or flag; the picked one is tinted with a small check at the end. On a
 * phone it is a drawer of large rows (`AdaptiveMenu`).
 */
import type { ReactElement, ReactNode } from 'react'
import { AdaptiveMenu } from './adaptive'

export interface Choice {
  value: string
  label: string
  icon: ReactNode
  lang?: string
}

export function ChoiceMenu({
  title,
  trigger,
  value,
  onValueChange,
  choices,
}: {
  title: string
  trigger: ReactElement
  value: string | undefined
  onValueChange: (value: string) => void
  choices: Choice[]
}) {
  return (
    <AdaptiveMenu
      title={title}
      labelled
      trigger={trigger}
      className="min-w-44 p-1.5"
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
