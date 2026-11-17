import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'

import { isLocale } from './i18n/locales'
import { routing } from './i18n/routing'
import { NONCE_HEADER, newNonce, sitePolicy } from './lib/csp'
import { LANGUAGE_PATH_HEADER, PICK_LANGUAGE_PATH } from './lib/locale'
import { serverUrl } from './lib/serverUrl'

const handleI18nRouting = createMiddleware(routing)

/**
 * Every public page lives under its language (/en/..., /hr/...), and carries the site's
 * Content-Security-Policy with a nonce of its own (src/lib/csp.ts).
 *
 * The policy goes on the request too: Next reads the nonce from the request's policy and puts it
 * on every script it renders. Both headers are always overwritten, so a visitor cannot choose a
 * nonce.
 *
 * - An address WITH a known language goes to next-intl, which hands the locale to the pages. If
 *   the site does not serve that language, the layout answers 404.
 * - An address WITHOUT one ("/", or an old "/contact") has to be sent to a language the site
 *   serves. That list is a setting in the database, which the proxy does not read, so the request
 *   is rewritten to a route handler that does (src/app/(frontend)/pick-language/route.ts). The
 *   original path travels in a header the proxy always overwrites, so a visitor cannot choose it.
 */
export function proxy(request: NextRequest) {
  const nonce = newNonce()
  const policy = sitePolicy({
    nonce,
    dev: process.env.NODE_ENV === 'development',
    siteUrl: serverUrl,
    statsScript: process.env.UMAMI_SCRIPT_URL?.trim(),
  })
  const headers = new Headers(request.headers)
  headers.set(NONCE_HEADER, nonce)
  headers.set('Content-Security-Policy', policy)

  const firstSegment = request.nextUrl.pathname.split('/')[1]
  let response: NextResponse
  if (isLocale(firstSegment)) {
    response = handleI18nRouting(new NextRequest(request, { headers }))
  } else {
    headers.set(LANGUAGE_PATH_HEADER, request.nextUrl.pathname)
    const target = request.nextUrl.clone()
    target.pathname = PICK_LANGUAGE_PATH
    response = NextResponse.rewrite(target, { request: { headers } })
  }
  response.headers.set('Content-Security-Policy', policy)
  return response
}

// Everything except Payload (/admin, /api), the share cards (/og), Next's own files and anything
// with a file extension (robots.txt, sitemap.xml, icons, uploaded images). Each exclusion is a
// whole first segment (followed by "/" or the end), so a page whose slug only starts with one of
// those words (/ogledi, /administracija) still gets its language. tests/int/proxy.int.spec.ts.
export const config = {
  matcher: ['/((?!(?:api|admin|og|_next|_vercel)(?:/|$)|.*\\..*).*)'],
}
