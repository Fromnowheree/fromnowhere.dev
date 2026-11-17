/**
 * The site's Content-Security-Policy, sent by the proxy (src/proxy.ts) on every page, with a fresh
 * nonce per request (docs: node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
 *
 * Scripts: only those carrying the request's nonce run (Next puts it on its own scripts, bundles
 * and inline data; the layout puts it on the head script and the statistics script), and what they
 * load ('strict-dynamic'). An injected <script>, an inline handler (onerror=…) or a javascript:
 * link runs nothing, and neither does a script from another host. Development adds 'unsafe-eval',
 * which React's dev build needs; production never sends it.
 *
 * Styles stay 'unsafe-inline': every line's colour reaches its map, row and page through a style
 * attribute (`--c`), and a style cannot run code. Everything else loads from the site itself,
 * plus `blob:` workers (the contact form's proof of work) and `data:`/`blob:` images.
 *
 * Payload's editor (/admin), the API, the share cards and files keep the plain policy in
 * next.config.ts: the proxy does not run there.
 */

/** The request header the proxy hands the nonce on in (read by src/lib/nonce.ts). */
export const NONCE_HEADER = 'x-nonce'

export type PolicyOptions = {
  nonce: string
  /** `next dev`: React's dev build needs eval, and hot reload a WebSocket. */
  dev: boolean
  /** The site's own address (SITE_URL): an https site upgrades any http request it makes. */
  siteUrl: string
  /** Where the statistics script lives (UMAMI_SCRIPT_URL), whose host receives its counts. */
  statsScript?: string
}

/** An origin a policy may name, or null: only an absolute https (or, in development, http) URL. */
const originOf = (value: string | undefined, dev: boolean): string | null => {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol === 'https:' || (dev && url.protocol === 'http:')) return url.origin
  } catch {
    // not a URL: nothing to allow
  }
  return null
}

/** A nonce: 128 random bits, base64. */
export const newNonce = (): string => {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

export const sitePolicy = ({ nonce, dev, siteUrl, statsScript }: PolicyOptions): string => {
  const stats = originOf(statsScript, dev)
  const directives: [string, ...string[]][] = [
    ['default-src', "'self'"],
    [
      'script-src',
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    ['style-src', "'self'", "'unsafe-inline'"],
    ['img-src', "'self'", 'data:', 'blob:'],
    ['font-src', "'self'"],
    ['connect-src', "'self'", ...(stats ? [stats] : []), ...(dev ? ['ws:'] : [])],
    ['worker-src', "'self'", 'blob:'],
    ['manifest-src', "'self'"],
    ['media-src', "'self'"],
    ['frame-src', "'none'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'self'"],
  ]
  const upgrade = !dev && siteUrl.startsWith('https:') ? ['upgrade-insecure-requests'] : []
  return [...directives.map((parts) => parts.join(' ')), ...upgrade].join('; ')
}
