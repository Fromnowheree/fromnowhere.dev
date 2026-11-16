import type { Locale } from '@/i18n/locales'

/** Bump when the card design changes, so apps that cached the old image fetch the new one. */
const CARD_VERSION = 2

export const shareCardSize = { width: 1200, height: 630 }

/** Short FNV-1a hash; only used to change the image URL when the title changes. */
const hash = (value: string) => {
  let h = 0x811c9dc5
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(36)
}

/**
 * URL of the branded share image for a page ('en', '/services/x' → '/og/en/services/x').
 * The card text is looked up from the CMS by that path; `v` only busts caches in chat apps.
 */
export const shareCardUrl = (locale: Locale, path: string, title: string) =>
  `/og/${locale}${path === '/' ? '' : path}?v=${hash(`${CARD_VERSION}:${title}`)}`
