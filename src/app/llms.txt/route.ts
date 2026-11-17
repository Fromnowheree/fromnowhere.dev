import { getTranslations } from 'next-intl/server'

import { defaultLocale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import {
  CONTACT_SEGMENT,
  displayAddress,
  noteHref,
  notesHref,
  pageHref,
  projectHref,
} from '@/lib/links'
import { localizedPath } from '@/lib/metadata'
import { getNotes, getPage, getProjects, getPublishedSummaries, getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'

// Read from the CMS on every request, like the sitemap: what is published now.
export const dynamic = 'force-dynamic'

/** Editor text on one line, safe inside Markdown link text: no line breaks, no brackets. */
const line = (value: string | null | undefined): string =>
  (value ?? '').replace(/\s+/g, ' ').replace(/[[\]]/g, '').trim()

const url = (path: string) => `${serverUrl}${localizedPath(defaultLocale, path)}`

/**
 * /llms.txt (https://llmstxt.org): the site in plain Markdown for language models and the tools
 * built on them. What the studio is, every published project with its page here and its own
 * address, the published pages, the notes while they are open, and how to get in touch. In
 * English, with the Croatian pages named; drafts never appear, nothing is invented. The live
 * status is left out, as on the share cards: a summary is kept far longer than a delay lasts.
 */
export async function GET() {
  const locale = defaultLocale
  const [studio, projects, notes, { pages }, tKind, tStatus] = await Promise.all([
    getStudio(locale),
    getProjects(locale),
    getNotes(locale),
    getPublishedSummaries(),
    getTranslations({ locale, namespace: 'kind' }),
    getTranslations({ locale, namespace: 'status' }),
  ])
  // About first, then the rest by title.
  const pageDocs = (await Promise.all(pages.map((page) => getPage(page.slug, locale))))
    .flatMap((page) => (page ? [page] : []))
    .sort(
      (a, b) =>
        Number(b.slug === 'about') - Number(a.slug === 'about') || a.title.localeCompare(b.title),
    )

  const out: string[] = [`# Fromnowhere`, '']
  const summary = line(studio.defaultDescription || studio.lede)
  if (summary) out.push(`> ${summary}`, '')
  out.push(
    `${serverUrl.replace(/^https?:\/\//, '')} is the studio's crossroad: one line per project, ` +
      'each leading to the project’s own site. Every page is in English (/en/…) and Croatian ' +
      '(/hr/…), with the same address after the language.',
    '',
  )

  if (projects.length > 0) {
    out.push('## Projects', '')
    for (const project of projects) {
      const where = (project.addresses ?? []).map((address) => address.url)
      const lives = where.length > 0 ? ` Lives at ${where.join(', ')}.` : ''
      out.push(
        `- [${line(project.name)}](${url(projectHref(project.slug ?? ''))}): ` +
          `Line ${lineNumber(project.line)}, ${tKind(project.kind).toLowerCase()}, ` +
          `${tStatus(project.status).toLowerCase()}. ${line(project.summary)}${lives}`,
      )
    }
    out.push('')
  }

  out.push('## Pages', '')
  for (const page of pageDocs) {
    const lead = line(page.lead)
    out.push(`- [${line(page.title)}](${url(pageHref(page.slug ?? ''))})${lead ? `: ${lead}` : ''}`)
  }
  out.push(
    `- [Contact](${url(`/${CONTACT_SEGMENT}`)}): a short form that relays a message to the studio.` +
      (studio.email ? ` Or write to ${studio.email}.` : ''),
    '',
  )

  if (notes.length > 0) {
    out.push('## Notes', '', `Short, dated notes on the work: [all notes](${url(notesHref)}).`, '')
    for (const note of notes) {
      const on = note.project ? ` On ${line(note.project.name)}.` : ''
      out.push(
        `- [${line(note.title)}](${url(noteHref(note.slug))}) (${note.date.slice(0, 10)}):` +
          ` ${line(note.summary)}${on}`,
      )
    }
    out.push('')
  }

  const elsewhere = (studio.profiles ?? []).map(
    (profile) => `- [${line(profile.label)}](${profile.url}): ${displayAddress(profile.url)}`,
  )
  out.push('## Optional', '', `- [Sitemap](${serverUrl}/sitemap.xml): every page in both languages`)
  if (notes.length > 0)
    out.push(`- [Notes feed](${url(`${notesHref}/feed.xml`)}): the notes as an Atom feed`)
  out.push(...elsewhere, '')

  return new Response(out.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
