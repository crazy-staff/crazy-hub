import { Card } from '@crazy-staff/ui'
import { createFileRoute } from '@tanstack/react-router'
import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { m } from '../../../paraglide/messages.js'
import { getLocale, locales, setLocale, type Locale } from '../../../paraglide/runtime.js'
import { LOCALE_NAMES } from '../../../components/language-menu'
import { Flag } from '../../../components/flag'
import { ChoiceField } from '../../../components/choice-field'

/** Language and theme. In-app notification preferences come with #11. */
export const Route = createFileRoute('/_app/settings/preferences')({
  component: Preferences,
})

function Preferences() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return (
    <div className="flex flex-col gap-6">
      <Card title={m.language()} description={m.settings_language_description()}>
        <ChoiceField
          title={m.language()}
          value={getLocale()}
          onValueChange={(value) => setLocale(value as Locale)}
          choices={locales.map((l) => ({
            value: l,
            label: LOCALE_NAMES[l],
            icon: <Flag locale={l} />,
            lang: l,
          }))}
        />
      </Card>
      <Card title={m.settings_theme()} description={m.settings_theme_description()}>
        <ChoiceField
          title={m.settings_theme()}
          value={mounted ? (theme ?? 'system') : undefined}
          onValueChange={setTheme}
          choices={[
            { value: 'light', label: m.settings_theme_light(), icon: <Sun className="size-4" /> },
            { value: 'dark', label: m.settings_theme_dark(), icon: <Moon className="size-4" /> },
            {
              value: 'system',
              label: m.settings_theme_system(),
              icon: <Monitor className="size-4" />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
