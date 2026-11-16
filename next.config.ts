import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(__filename)

// next-intl reads the request's language and messages from here (src/i18n/request.ts).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

// The page-level policy every response carries, the site's and the editor's alike: no plugins, no
// <base> pointing elsewhere (which would send every relative link and script to another host),
// forms post only to this site, and only this site may frame it (the editor's live preview). It
// limits what an injected tag could do without limiting scripts, styles or images: those need a
// per-request nonce in Next, and would have to be checked against Payload's editor.
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

const nextConfig: NextConfig = {
  output: 'standalone',
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: contentSecurityPolicy }],
      },
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
