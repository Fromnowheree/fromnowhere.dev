import createMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'

import { isLocale } from './i18n/locales'
import { routing } from './i18n/routing'
import { LANGUAGE_PATH_HEADER, PICK_LANGUAGE_PATH } from './lib/locale'

const handleI18nRouting = createMiddleware(routing)

/**
 * Every public page lives under its language (/en/..., /hr/...).
 *
 * - An address WITH a known language goes to next-intl, which hands the locale to the pages. If
 *   the site does not serve that language, the layout answers 404.
 * - An address WITHOUT one ("/", or an old "/contact") has to be sent to a language the site
 *   serves. That list is a setting in the database, which the proxy does not read, so the request
 *   is rewritten to a route handler that does (src/app/(frontend)/pick-language/route.ts). The
 *   original path travels in a header the proxy always overwrites, so a visitor cannot choose it.
 */
export function proxy(request: NextRequest) {
  const firstSegment = request.nextUrl.pathname.split('/')[1]
  if (isLocale(firstSegment)) return handleI18nRouting(request)

  const headers = new Headers(request.headers)
  headers.set(LANGUAGE_PATH_HEADER, request.nextUrl.pathname)
  const target = request.nextUrl.clone()
  target.pathname = PICK_LANGUAGE_PATH
  return NextResponse.rewrite(target, { request: { headers } })
}

// Everything except Payload (/admin, /api), the share cards (/og), Next's own files and anything
// with a file extension (robots.txt, sitemap.xml, icons, uploaded images). Each exclusion is a
// whole first segment (followed by "/" or the end), so a page whose slug only starts with one of
// those words (/ogledi, /administracija) still gets its language. tests/int/proxy.int.spec.ts.
export const config = {
  matcher: ['/((?!(?:api|admin|og|_next|_vercel)(?:/|$)|.*\\..*).*)'],
}
