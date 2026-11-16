import { getTranslations } from 'next-intl/server'

import { isSlug } from '@/fields/slug'
import { isLocale, type Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { CONTACT_SEGMENT, PROJECTS_SEGMENT } from '@/lib/links'
import { getPage, getProject, getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import { renderShareCard } from './ShareCard'

// Titles come from the CMS on every request, like the pages themselves.
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ locale: string; path?: string[] }> }

/**
 * The card's kicker and title for a page's path (the same path as the page, without its
 * language). Only what is published gets a card, and its text never comes from the URL.
 */
async function cardText(
  locale: Locale,
  segments: string[],
): Promise<{ kicker: string; title: string } | null> {
  // Malformed segments (e.g. a NUL byte, which Postgres rejects) get the same 404 as unknown pages.
  if (!segments.every(isSlug)) return null
  if (segments.length === 0) {
    const studio = await getStudio(locale)
    return { kicker: 'fromnowhere.dev', title: studio.headline || 'Fromnowhere' }
  }
  if (segments.length === 1 && segments[0] === CONTACT_SEGMENT) {
    const t = await getTranslations({ locale, namespace: 'contact' })
    return { kicker: 'fromnowhere.dev', title: t('title') }
  }
  if (segments.length === 1) {
    const page = await getPage(segments[0], locale)
    return page ? { kicker: 'fromnowhere.dev', title: page.title } : null
  }
  if (segments.length === 2 && segments[0] === PROJECTS_SEGMENT) {
    const project = await getProject(segments[1], locale)
    if (!project) return null
    const t = await getTranslations({ locale, namespace: 'project' })
    return { kicker: t('line', { number: lineNumber(project.line) }), title: project.name }
  }
  return null
}

export async function GET(_request: Request, { params }: Context) {
  const { locale, path: segments } = await params
  if (!isLocale(locale)) return new Response('Not found', { status: 404 })
  const text = await cardText(locale, segments ?? [])
  if (!text) return new Response('Not found', { status: 404 })
  return renderShareCard({ ...text, domain: new URL(serverUrl).host.replace(/^www\./, '') })
}
