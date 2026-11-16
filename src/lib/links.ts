import { MAX_LINK_LENGTH, MAX_SLUG_LENGTH } from './content'

/**
 * The one rule for every link an editor can write: a link inside rich text, a project's address,
 * a short link's target. The rule itself (`safeLink`) comes from NMT by way of NMT-PublicWeb; the
 * path rules beneath it are this site's.
 *
 * A link is either
 *   - a path on this site, WITHOUT its language ("/contact", "/projects/giogio", "/about", "/"):
 *     the visitor's language is added when it renders, so one link serves every language; or
 *   - an absolute https:, mailto: or tel: address.
 * A site path must name something public: the home page, the contact page, a published project or
 * a published page. That is checked at save time (src/fields/link.ts) and again when the link
 * renders, so a page unpublished later hides the link instead of sending visitors to a 404.
 */

/** Where a project's own page lives: /<language>/projects/<slug>. */
export const PROJECTS_SEGMENT = 'projects'

/** The built-in contact page: /<language>/contact. */
export const CONTACT_SEGMENT = 'contact'

/** Built-in first segments a page slug may not take, or the built-in route would hide the page. */
export const RESERVED_PAGE_SLUGS = [PROJECTS_SEGMENT, CONTACT_SEGMENT]

/** A page or project address segment, as `slugify` (src/fields/slug.ts) writes it. */
export const isSlug = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= MAX_SLUG_LENGTH && /^[a-z0-9-]+$/.test(value)

/** A page's path without its language. */
export const pageHref = (slug: string): string => `/${slug}`

/** A project's page, without its language. */
export const projectHref = (slug: string): string => `/${PROJECTS_SEGMENT}/${slug}`

const LINK_SCHEMES = new Set(['https:', 'mailto:', 'tel:'])

/**
 * Accepted: a site path (starts with `/`, not `//`), or an absolute `https:`, `mailto:` or `tel:`
 * URL. Anything else, above all `javascript:` and `data:`, is refused, and so is any backslash,
 * space or control character: browsers read `/\evil.example` as the protocol-relative
 * `//evil.example`, which would pass a naive "starts with one slash" test. Returns the link
 * unchanged when it passes, null when it does not.
 */
export const safeLink = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length === 0 || value.length > MAX_LINK_LENGTH) return null
  if (/[\\\u0000- \u007f]/.test(value)) return null
  if (value.startsWith('/')) return value.startsWith('//') ? null : value
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  return LINK_SCHEMES.has(url.protocol) ? value : null
}

/** What a link points at, once it has passed `safeLink`. */
export type LinkTarget =
  | { kind: 'external' }
  | { kind: 'home' }
  | { kind: 'contact' }
  | { kind: 'page'; slug: string }
  | { kind: 'project'; slug: string }

/**
 * What an authored link points at, or null when it fails the rule or is a site path that cannot
 * name anything here (a path with its language, "/en/contact", is one: the language is added when
 * the link renders). A query or fragment is ignored ("/contact#form" points at the contact page).
 */
export const linkTarget = (value: unknown): LinkTarget | null => {
  const link = safeLink(value)
  if (link === null) return null
  if (!link.startsWith('/')) return { kind: 'external' }
  const bare = link.replace(/[?#].*$/s, '').replace(/\/+$/, '')
  if (bare === '') return { kind: 'home' }
  const segments = bare.slice(1).split('/')
  if (segments.length === 1 && segments[0] === CONTACT_SEGMENT) return { kind: 'contact' }
  if (segments.length === 1 && isSlug(segments[0]) && !RESERVED_PAGE_SLUGS.includes(segments[0]))
    return { kind: 'page', slug: segments[0] }
  if (segments.length === 2 && segments[0] === PROJECTS_SEGMENT && isSlug(segments[1]))
    return { kind: 'project', slug: segments[1] }
  return null
}

/** The slugs a site path may point at: published pages and published projects. */
export interface PublishedIndex {
  pages: ReadonlySet<string>
  projects: ReadonlySet<string>
}

/**
 * The link as it may render: unchanged when it passes the rule and, for a site path, names
 * something public; otherwise null, and whatever carries it is hidden.
 */
export const resolveLink = (value: unknown, index: PublishedIndex): string | null => {
  const target = linkTarget(value)
  if (target === null) return null
  if (target.kind === 'page' && !index.pages.has(target.slug)) return null
  if (target.kind === 'project' && !index.projects.has(target.slug)) return null
  return value as string
}

/**
 * An absolute https:// address and nothing else, with no user name or password in it: the rule
 * for a project's addresses, profiles on other sites and short-link targets. Returns the address,
 * or null.
 */
export const httpsAddressOrNull = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > MAX_LINK_LENGTH) return null
  if (/[\\\u0000- \u007f]/.test(value)) return null
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return null
  return value
}

/** An address as a sign shows it: "https://giogio.music/" → "giogio.music". */
export const displayAddress = (value: string): string => {
  try {
    const url = new URL(value)
    const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')
    return `${url.host.replace(/^www\./, '')}${path}`
  } catch {
    return value
  }
}

/**
 * A rendered href in the visitor's language: a site path gets the language in front ("/contact"
 * → "/en/contact", "/" → "/en", "/#form" → "/en#form"); any other link is unchanged. For places
 * that cannot use the i18n Link (rich text, plain anchors).
 */
export const withLocale = (locale: string, href: string): string => {
  if (!href.startsWith('/')) return href
  if (href === '/') return `/${locale}`
  if (href.startsWith('/?') || href.startsWith('/#')) return `/${locale}${href.slice(1)}`
  return `/${locale}${href}`
}
