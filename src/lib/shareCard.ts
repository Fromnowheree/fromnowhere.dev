import type { Locale } from '@/i18n/locales'
import { LINE_COLOURS } from '@/lib/routeMap'

/** Bump when the card design changes, so apps that cached the old image fetch the new one. */
const CARD_VERSION = 3

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

/**
 * The night palette (site.css `:root`) as plain values: an image has no CSS variables.
 * tests/int/routeMap.int.spec.ts checks they still match the stylesheet.
 */
export const CARD_PALETTE = {
  night: '#05060f',
  ground: '#090b19',
  surface2: '#181c38',
  track: '#04050c',
  text: '#eeedf6',
  muted: '#a8acc6',
  dim: '#7b80a3',
  accent: '#a796ff',
  trainCore: '#fffaf0',
  lines: ['#5b8cff', '#ff5fa8', '#ffb347', '#45e0b4', '#ff7a59', '#c4e85c'],
} as const

/** A line's colour by line number, as `lineColour` picks the token. */
export const cardLineColour = (line: number): string =>
  CARD_PALETTE.lines[(Math.max(1, Math.floor(line) || 1) - 1) % LINE_COLOURS] ??
  CARD_PALETTE.lines[0]
