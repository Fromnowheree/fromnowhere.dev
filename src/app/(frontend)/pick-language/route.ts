import type { NextRequest } from 'next/server'

import { chooseLocale, LANGUAGE_PATH_HEADER, LOCALE_COOKIE, sitePath } from '@/lib/locale'
import { getServedLocales, resolveShortLink } from '@/lib/payload'
import { shortAliasOf } from '@/lib/shortLinks'

// Reads the short links and languages on every request; a build-time answer would be the build's.
export const dynamic = 'force-dynamic'

/**
 * An address without a language ("/", "/contact", "/giogio"), rewritten here by src/proxy.ts.
 *
 * - One word that is a short link (Content → Short links) goes where the link says: another site,
 *   or a project's page in the visitor's language.
 * - Anything else is redirected to the same path in a language the site serves. The Location is
 *   relative, so it is right whatever host name the site is reached by.
 */
export async function GET(request: NextRequest) {
  const locale = chooseLocale({
    served: await getServedLocales(),
    cookie: request.cookies.get(LOCALE_COOKIE)?.value,
    acceptLanguage: request.headers.get('accept-language'),
  })
  const path = sitePath(request.headers.get(LANGUAGE_PATH_HEADER))

  const alias = shortAliasOf(path)
  const target = alias ? await resolveShortLink(alias) : null
  if (target) {
    return new Response(null, {
      // Temporary: a link may be pointed somewhere else later, and browsers keep a 308 for good.
      status: 307,
      headers: {
        Location: target.startsWith('/') ? `/${locale}${target}` : target,
        'Cache-Control': 'private, no-store',
        Vary: 'Accept-Language, Cookie',
      },
    })
  }

  return new Response(null, {
    status: 307,
    headers: {
      Location: `/${locale}${path === '/' ? '' : path}${request.nextUrl.search}`,
      // The answer depends on who asks, so no shared cache may keep one visitor's redirect.
      'Cache-Control': 'private, no-store',
      Vary: 'Accept-Language, Cookie',
    },
  })
}
