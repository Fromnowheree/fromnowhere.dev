/**
 * The languages of the site. They are fixed in code because Payload stores the content locales as
 * a Postgres enum: adding one is a schema change with a migration, never a setting.
 *
 * The order matters: English is the main language (where a visitor lands when nothing says which
 * they want) and comes first in the language switch.
 */
export const locales = ['en', 'hr'] as const

export type Locale = (typeof locales)[number]

/** English first. Payload's default content locale, and the fallback for any field left empty in
 * another language. */
export const defaultLocale: Locale = 'en'

export const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (locales as readonly string[]).includes(value)

/** Each language under its own name, so a visitor finds theirs whatever page they are on. */
export const localeNames: Record<Locale, string> = {
  en: 'English',
  hr: 'Hrvatski',
}

/** Open Graph wants language_TERRITORY. */
export const ogLocales: Record<Locale, string> = {
  en: 'en_US',
  hr: 'hr_HR',
}

/** Keeps the canonical order and drops anything that is not a known locale. */
export const orderLocales = (values: readonly unknown[] | null | undefined): Locale[] =>
  locales.filter((locale) => values?.includes(locale))
