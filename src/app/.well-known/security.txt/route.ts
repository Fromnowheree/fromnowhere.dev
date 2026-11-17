import { defaultLocale } from '@/i18n/locales'
import { getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'

// Written per request: the studio's address is the CMS's, and Expires moves with the day.
export const dynamic = 'force-dynamic'

/** How far ahead Expires is: RFC 9116 asks for less than a year. */
const VALID_DAYS = 180

/**
 * /.well-known/security.txt (RFC 9116): where to report a security problem with this site. The
 * contact is the studio's own address (Studio → e-mail); without one there is no file (404),
 * since a security.txt with no Contact is invalid.
 */
export async function GET() {
  const studio = await getStudio(defaultLocale)
  const email = studio.email?.trim()
  if (!email) return new Response('Not found', { status: 404 })

  const expires = new Date(Date.now() + VALID_DAYS * 24 * 60 * 60 * 1000)
  expires.setUTCHours(0, 0, 0, 0)
  const body = [
    `Contact: mailto:${email}`,
    `Expires: ${expires.toISOString()}`,
    'Preferred-Languages: en, hr',
    `Canonical: ${serverUrl}/.well-known/security.txt`,
    '',
  ].join('\n')
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
