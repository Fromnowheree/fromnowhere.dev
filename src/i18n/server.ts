import { getLocale } from 'next-intl/server'

import { defaultLocale, isLocale, type Locale } from './locales'

/** The page's language, as a Locale (next-intl types it as a plain string). */
export async function currentLocale(): Promise<Locale> {
  const locale = await getLocale()
  return isLocale(locale) ? locale : defaultLocale
}

/** A [locale] route parameter as a Locale. The proxy only lets known ones through. */
export const asLocale = (value: string): Locale => (isLocale(value) ? value : defaultLocale)
