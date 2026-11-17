import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// next-intl reads the request's language and messages from here (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// The plain policy every response carries: no plugins, no <base> pointing elsewhere (which would
// send every relative link and script to another host), forms post only to this site, and only
// this site may frame it (the editor's live preview). The site's pages carry a second, strict one
// from the proxy, with a nonce for scripts (src/lib/csp.ts); a browser enforces both. The editor
// (/admin) keeps only this one: Payload's admin is not built for a nonce.
// Sent by the app rather than Caddy, so the dev server and the tests see it too.
const contentSecurityPolicy = [
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

// An uploaded file is served from the site's own origin, and an SVG is a document that can carry
// script: opened by its address, it would run as the site, beside a signed-in editor's session.
// Payload sends `script-src 'none'; frame-src 'none'; object-src 'none'` on the SVGs it serves,
// but the header below replaces a response's own, so the file route gets Payload's policy and the
// site's together (for every upload; a picture needs no script either). The later rule wins.
const uploadPolicy = [
  "script-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ')

// Sent on every response by the app as well as by Caddy (caddy/Caddyfile), so they hold without
// it: no guessing a file's type from its bytes, addresses leave the site as an origin only, no
// camera, microphone, location or payment, and a page another site opened cannot reach back into
// it (window.opener). HSTS stays Caddy's: it means something only over HTTPS.
const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  output: 'standalone',
  // No "X-Powered-By: Next.js": nothing a visitor needs, and a free hint for anyone probing.
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      {
        source: '/api/media/file/:path*',
        headers: [{ key: 'Content-Security-Policy', value: uploadPolicy }],
      },
    ]
  },
  // Share images (/og/...) read their font from disk, so the standalone build must ship it.
  outputFileTracingIncludes: {
    '/og/**': ['./src/assets/fonts/*'],
  },
  // Dev only: lets phones on the local network load the dev server (e.g. 192.168.1.20).
  allowedDevOrigins: process.env.DEV_ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()),
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(withNextIntl(nextConfig), { devBundleServerPackages: false })
