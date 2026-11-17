import { getTranslations } from 'next-intl/server'

import { isLocale } from '@/i18n/locales'
import { noteHref, notesHref } from '@/lib/links'
import { getNotes } from '@/lib/payload'
import { pageUrl, STUDIO_ID } from '@/lib/structuredData'

// The notes as they are now, like the pages.
export const dynamic = 'force-dynamic'

type Context = { params: Promise<{ locale: string }> }

/** Text in XML: the five characters that could end a value or start markup, escaped. */
const xml = (value: string): string =>
  value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`)

/**
 * The notes as an Atom feed, one per language (/en/notes/feed.xml, /hr/notes/feed.xml), for a feed
 * reader: each note's title, day, summary and address, the newest first. Named by the notes page
 * (<link rel="alternate">) and linked under its log. Like the notes, absent (404) while fewer than
 * three are published.
 */
export async function GET(_request: Request, { params }: Context) {
  const { locale } = await params
  if (!isLocale(locale)) return new Response('Not found', { status: 404 })
  const [notes, t] = await Promise.all([
    getNotes(locale),
    getTranslations({ locale, namespace: 'notes' }),
  ])
  if (notes.length === 0) return new Response('Not found', { status: 404 })

  const self = pageUrl(locale, `${notesHref}/feed.xml`)
  const entries = notes.map((note) => {
    const url = pageUrl(locale, noteHref(note.slug))
    const about = note.project
      ? `<category term="${xml(note.project.slug)}" label="${xml(note.project.name)}"/>`
      : ''
    return [
      '  <entry>',
      `    <id>${xml(url)}</id>`,
      `    <title>${xml(note.title)}</title>`,
      `    <link rel="alternate" type="text/html" href="${xml(url)}"/>`,
      `    <published>${xml(note.date)}</published>`,
      `    <updated>${xml(note.date)}</updated>`,
      `    <summary>${xml(note.summary)}</summary>`,
      about ? `    ${about}` : '',
      '  </entry>',
    ]
      .filter(Boolean)
      .join('\n')
  })

  const body = [
    '<?xml version="1.0" encoding="utf-8"?>',
    `<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="${locale}">`,
    `  <id>${xml(self)}</id>`,
    `  <title>${xml(`${t('title')} · Fromnowhere`)}</title>`,
    `  <subtitle>${xml(t('lead'))}</subtitle>`,
    `  <link rel="self" type="application/atom+xml" href="${xml(self)}"/>`,
    `  <link rel="alternate" type="text/html" href="${xml(pageUrl(locale, notesHref))}"/>`,
    `  <updated>${xml(notes[0]!.date)}</updated>`,
    `  <author><name>Fromnowhere</name><uri>${xml(STUDIO_ID.replace(/\/#studio$/, ''))}</uri></author>`,
    ...entries,
    '</feed>',
    '',
  ].join('\n')

  return new Response(body, {
    headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' },
  })
}
