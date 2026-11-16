import type { Locale } from './locales'

/**
 * A label for the Payload admin in both of its languages. Payload shows the one matching the
 * editor's interface language (English or Croatian, `i18n.supportedLanguages`).
 */
export const l = (en: string, hr: string): Record<Locale, string> => ({ en, hr })

/** The same choice for text Payload does not translate itself, such as a validation message. */
export const pickLabel = (language: string | undefined, label: Record<Locale, string>): string =>
  language === 'hr' ? label.hr : label.en
