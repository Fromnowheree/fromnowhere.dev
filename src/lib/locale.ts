import { isLocale, type Locale } from '@/i18n/locales'

/** Where the proxy sends an address that names no language, and the header carrying its path. */
export const PICK_LANGUAGE_PATH = '/pick-language'
export const LANGUAGE_PATH_HEADER = 'x-site-path'

/** next-intl remembers a visitor's last language in this cookie. */
export const LOCALE_COOKIE = 'NEXT_LOCALE'

/**
 * Accept-Language as a list of primary language subtags, most wanted first
 * ("hr-HR,hr;q=0.9,en;q=0.5" → hr, hr, en). Malformed entries are ignored.
 */
export const acceptedLanguages = (header: string | null | undefined): string[] =>
  (header ?? '')
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const quality = q ? Number(q.slice(2)) : 1
      return { language: tag.split('-')[0]!.trim().toLowerCase(), quality, index }
    })
    .filter(({ language, quality }) => /^[a-z]{2,3}$/.test(language) && quality > 0)
    .sort((a, b) => b.quality - a.quality || a.index - b.index)
    .map(({ language }) => language)

/**
 * The language for a visitor who arrived at an address without one: the language they chose
 * before (the cookie), else the first served one their browser asks for, else the site's main
 * language (the first served one, src/lib/payload.ts getServedLocales).
 * Only ever one of `served`, so nobody is sent to a language that would answer 404.
 */
export function chooseLocale({
  served,
  cookie,
  acceptLanguage,
}: {
  served: readonly Locale[]
  cookie?: string | null
  acceptLanguage?: string | null
}): Locale {
  if (isLocale(cookie) && served.includes(cookie)) return cookie
  const wanted = acceptedLanguages(acceptLanguage).find(
    (language): language is Locale => isLocale(language) && served.includes(language),
  )
  return wanted ?? served[0]!
}

/**
 * The path from the proxy's header, if it is a plain path on this site. Anything that could
 * point elsewhere ("//host", a backslash, a control character) becomes "/".
 */
export const sitePath = (value: string | null | undefined): string =>
  value && /^\/(?![/\\])[^\\\s]*$/.test(value) ? value : '/'
