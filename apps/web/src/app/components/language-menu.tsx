import { Button } from '@crazy-staff/ui'
import { Languages } from 'lucide-react'
import { getLocale, locales, setLocale, type Locale } from '../paraglide/runtime.js'
import { m } from '../paraglide/messages.js'
import { ChoiceMenu } from './choice-menu'
import { Flag } from './flag'

/** Each language in its own name, so anyone can find theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  pl: 'Polski',
  de: 'Deutsch',
  ru: 'Русский',
}

/** Picks the UI language (Paraglide: cookie, then the browser's languages, then English). */
export function LanguageMenu() {
  return (
    <ChoiceMenu
      title={m.language()}
      trigger={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={m.language()}
          title={m.language()}
          className="text-muted hover:text-foreground"
        >
          <Languages />
        </Button>
      }
      value={getLocale()}
      onValueChange={(value) => setLocale(value as Locale)}
      choices={locales.map((locale) => ({
        value: locale,
        label: LOCALE_NAMES[locale],
        icon: <Flag locale={locale} />,
        lang: locale,
      }))}
    />
  )
}
