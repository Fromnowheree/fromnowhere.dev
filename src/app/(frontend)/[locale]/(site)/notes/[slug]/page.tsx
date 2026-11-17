import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type React from 'react'

import { RichText } from '@/components/RichText'
import { NoteArrow, noteDates, NoteOwner, noteColour } from '@/components/site/Notes'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { lineNumber } from '@/lib/format'
import { noteHref, notesHref, projectHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getNote, getNotes, getPublishedIndex } from '@/lib/payload'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const note = await getNote(slug, locale)
  if (!note) return {}
  return pageMetadata(locale, note.meta, {
    title: note.title,
    description: note.summary,
    path: noteHref(slug),
  })
}

const delay = (i: number) => ({ '--i': i }) as React.CSSProperties

/**
 * One note: its line and day, its title and text, and beside it the short route of its line's
 * notes with "You are here", then the way to the project's page. A note about the studio itself
 * has no line: beside it are the newest other notes instead.
 */
export default async function NotePage({ params }: Props) {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const [note, all, index, t, tProject] = await Promise.all([
    getNote(slug, locale),
    getNotes(locale),
    getPublishedIndex(),
    getTranslations({ locale, namespace: 'notes' }),
    getTranslations({ locale, namespace: 'project' }),
  ])
  if (!note) notFound()
  const d = await noteDates(locale)
  const project = note.project
  const route = project
    ? all.filter((other) => other.project?.slug === project.slug)
    : all.filter((other) => other.slug !== slug).slice(0, 4)

  return (
    <article className="note-page" style={{ '--c': noteColour(project) } as React.CSSProperties}>
      <p className="note-page__back">
        <Link className="back" href={notesHref}>
          <span aria-hidden="true">←</span>
          <span className="back__rail" aria-hidden="true" />
          {t('allNotes')}
        </Link>
      </p>
      <header className="page-head">
        <p className="kicker fnw-enter" style={delay(0)}>
          {project ? (
            <Link href={{ pathname: notesHref, query: { line: project.slug } }}>
              {tProject('line', { number: lineNumber(project.line) })} · {project.name}
            </Link>
          ) : (
            t('studio')
          )}
          <span aria-hidden="true">·</span>
          <time dateTime={note.date}>{d.long(note.date)}</time>
        </p>
        <h1 className="fnw-enter" style={delay(1)}>
          {note.title}
        </h1>
        <p className="page-head__lead fnw-enter" style={delay(2)}>
          {note.summary}
        </p>
      </header>

      <div className="note-page__body">
        <div className="note-page__text">
          <RichText data={note.content} locale={locale} index={index} />
        </div>

        {(project || route.length > 0) && (
          <aside
            className={`notes-route${project ? '' : ' notes-route--studio'}`}
            aria-labelledby="notes-route"
          >
            <p className="notes-route__head">
              {project && (
                <span className="line-no" aria-hidden="true">
                  {lineNumber(project.line)}
                </span>
              )}
              {project ? t('onThisLine', { count: route.length }) : t('more')}
            </p>
            <h2 className="notes-route__name" id="notes-route">
              {project ? (
                <Link href={{ pathname: notesHref, query: { line: project.slug } }}>
                  {project.name}
                </Link>
              ) : (
                t('more')
              )}
            </h2>
            <ol>
              {route.map((stop) =>
                stop.slug === slug ? (
                  <li key={stop.slug} className="is-here">
                    <div aria-current="page">
                      {stop.title}
                      <em>{t('here')}</em>
                      <time dateTime={stop.date}>{d.long(stop.date)}</time>
                    </div>
                  </li>
                ) : (
                  <li
                    key={stop.slug}
                    style={{ '--c': noteColour(stop.project) } as React.CSSProperties}
                  >
                    <Link href={noteHref(stop.slug)}>
                      {!project && (
                        <span className="notes-owner">
                          <NoteOwner project={stop.project} studio={t('studio')} />
                        </span>
                      )}
                      {stop.title}
                      <time dateTime={stop.date}>{d.long(stop.date)}</time>
                    </Link>
                  </li>
                ),
              )}
            </ol>
            <div className="notes-route__exits">
              {project ? (
                <Link href={projectHref(project.slug)}>
                  {t('projectPage')}
                  <NoteArrow />
                </Link>
              ) : (
                <Link href={notesHref}>
                  {t('allNotes')}
                  <NoteArrow />
                </Link>
              )}
            </div>
          </aside>
        )}
      </div>
    </article>
  )
}
