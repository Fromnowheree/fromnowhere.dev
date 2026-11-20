import { isLocale } from '../i18n/locales'
import { isSlug, RESERVED_PAGE_SLUGS } from './links'

/**
 * First segments the site itself answers, which a short link may never take: the languages, the
 * paths the proxy leaves alone (src/proxy.ts matcher) or rewrites to, and the built-in pages
 * (/contact, /projects, /services, /capabilities), whose address without a language would otherwise lead off to the link.
 */
const TAKEN = new Set([
  'api',
  'admin',
  'og',
  '_next',
  '_vercel',
  'pick-language',
  'sitemap',
  'robots',
  ...RESERVED_PAGE_SLUGS,
])

/** Whether a word can be a short link (fromnowhere.dev/<word>). */
export const isShortAlias = (value: unknown): value is string =>
  isSlug(value) && value.length <= 40 && !isLocale(value) && !TAKEN.has(value)

/**
 * The one word of a path without a language ("/giogio" → "giogio"), or null when the path is
 * anything else ("/", "/a/b", "/giogio/"). Only such a path can be a short link.
 */
export const shortAliasOf = (path: string): string | null => {
  const match = /^\/([a-z0-9-]+)$/.exec(path)
  return match && isShortAlias(match[1]) ? match[1] : null
}
