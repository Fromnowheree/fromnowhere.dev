'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Link, usePathname } from '@/i18n/navigation'
import { locales, type Locale } from '@/i18n/locales'

/**
 * The same page in the other language. Page addresses are the same in every language, so
 * switching keeps the visitor where they are. Short codes (EN, HR) with each language's own name
 * for screen readers.
 */
export function LanguageSwitch() {
  const t = useTranslations('language')
  const current = useLocale() as Locale
  const pathname = usePathname()

  return (
    <nav aria-label={t('label')}>
      <ul className="lang">
        {locales.map((locale) => (
          <li key={locale}>
            <Link
              href={pathname}
              locale={locale}
              hrefLang={locale}
              lang={locale}
              aria-current={locale === current ? 'true' : undefined}
              aria-label={new Intl.DisplayNames([locale], { type: 'language' }).of(locale)}
              className="lang__opt"
            >
              {locale.toUpperCase()}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
