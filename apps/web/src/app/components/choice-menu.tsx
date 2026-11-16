/**
 * A dropdown to pick one of a few options (language, theme): a title with room under it, then the
 * options with their icon or flag; the picked one is tinted and carries a small check at the end
 * instead of crazy-ui's dot column in front (owner's note, round 6: the indicator took too much room).
 */
import { DropdownMenu } from '@crazy-staff/ui'
import { Check } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

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
    <DropdownMenu.Root>
      <DropdownMenu.Trigger render={trigger} />
      <DropdownMenu.Content align="end" className="min-w-44 p-1.5">
        <DropdownMenu.Group>
          <DropdownMenu.GroupLabel className="px-2.5 pt-1 pb-2">{title}</DropdownMenu.GroupLabel>
          <DropdownMenu.RadioGroup
            value={value}
            onValueChange={(next) => onValueChange(String(next))}
            className="flex flex-col gap-0.5"
          >
            {choices.map((choice) => (
              <DropdownMenu.RadioItem
                key={choice.value}
                value={choice.value}
                lang={choice.lang}
                className={
                  // drop the leading indicator column; the picked option is tinted with a check
                  '[&>span:first-child]:hidden data-[checked]:bg-accent-soft/60 data-[checked]:text-accent-soft-foreground data-[checked]:[&>svg]:text-accent-soft-foreground'
                }
              >
                {choice.icon}
                <span className="flex-1">{choice.label}</span>
                {choice.value === value && <Check className="size-3.5! stroke-[2.5]" />}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Group>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  )
}
