import { getTranslations } from 'next-intl/server'

import { isSlug } from '@/fields/slug'
import { isLocale, type Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { CONTACT_SEGMENT, PROJECTS_SEGMENT } from '@/lib/links'
import { getPage, getProject, getProjects, getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import { cardLineColour } from '@/lib/shareCard'
import { renderShareCard, type CardLine } from './ShareCard'

// Titles come from the CMS on every request, like the pages themselves.
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ locale: string; path?: string[] }> }

/**
 * The card's kicker and title for a page's path (the same path as the page, without its
 * language). Only what is published gets a card, and its text never comes from the URL.
 */
type CardText = { kicker: string; title: string; slug?: string; accent?: string }

async function cardText(locale: Locale, segments: string[]): Promise<CardText | null> {
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
    const [t, tKind] = await Promise.all([
      getTranslations({ locale, namespace: 'project' }),
      getTranslations({ locale, namespace: 'kind' }),
    ])
    return {
      kicker: `${t('line', { number: lineNumber(project.line) })} · ${tKind(project.kind)}`,
      title: project.name,
      slug: project.slug ?? undefined,
      accent: cardLineColour(project.line),
    }
  }
  return null
}

export async function GET(_request: Request, { params }: Context) {
  const { locale, path: segments } = await params
  if (!isLocale(locale)) return new Response('Not found', { status: 404 })
  const text = await cardText(locale, segments ?? [])
  if (!text) return new Response('Not found', { status: 404 })
  // The map as the editor set it, not the live status: a card is kept by chat apps for days, and
  // a passing delay should not travel with it. A project's card lights its own line; any other
  // page's card lights them all.
  const lines: CardLine[] = (await getProjects(locale)).map((project) => ({
    line: project.line,
    state: project.status,
    stops: Math.max(0, (project.addresses?.length ?? 0) - 1),
    lit: !text.slug || project.slug === text.slug,
  }))
  return renderShareCard({
    title: text.title,
    kicker: text.kicker,
    accent: text.accent,
    lines,
    domain: new URL(serverUrl).host.replace(/^www\./, ''),
  })
}
