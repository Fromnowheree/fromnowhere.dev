import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type React from 'react'

import { noteDates, NotesLog, noteColour } from '@/components/site/Notes'
import { NotesMotion } from '@/components/site/NotesMotion'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { lineNumber } from '@/lib/format'
import { notesHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { linesOf } from '@/lib/notes'
import { getNotes } from '@/lib/payload'

type Props = {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ line?: string | string[] }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const [notes, t] = await Promise.all([
    getNotes(locale),
    getTranslations({ locale, namespace: 'notes' }),
  ])
  if (notes.length === 0) return {}
  return pageMetadata(locale, null, { title: t('title'), description: t('lead'), path: notesHref })
}

const delay = (i: number) => ({ '--i': i }) as React.CSSProperties

/**
 * The notes (docs/prototypes/notes.html): the newest first on one rail, each stop in its line's
 * colour, and a chip per line that has notes to show only that line's (`?line=<project>`). Absent
 * (404) while fewer than three notes are published.
 */
export default async function NotesPage({ params, searchParams }: Props) {
  const locale = asLocale((await params).locale)
  const [all, t, line] = await Promise.all([
    getNotes(locale),
    getTranslations({ locale, namespace: 'notes' }),
    searchParams.then(({ line }) => (typeof line === 'string' ? line : null)),
  ])
  if (all.length === 0) notFound()

  const lines = linesOf(all)
  // A line nobody wrote about (or an address made up by hand) shows every note.
  const picked = lines.find((project) => project.slug === line) ?? null
  const notes = picked ? all.filter((note) => note.project?.slug === picked.slug) : all
  const d = await noteDates(locale)
  const number = picked ? lineNumber(picked.line) : ''

  return (
    <div className="notes-page" style={{ '--c': noteColour(picked) } as React.CSSProperties}>
      <header className="page-head notes-head">
        <p className="kicker fnw-enter" style={delay(0)}>
          {t('kicker')}
        </p>
        <h1 className="fnw-enter" style={delay(1)}>
          {picked ? t('titleLine', { number }) : t('title')}
          <span className="hero__point notes-head__point" aria-hidden="true" />
        </h1>
        <div className="notes-head__row">
          <p className="page-head__lead fnw-enter" style={delay(2)}>
            {picked ? t('leadLine', { name: picked.name }) : t('lead')}
          </p>
          <dl className="tally fnw-enter" style={delay(3)} aria-label={t('tally')}>
            <div>
              <dt>{t('tallyNotes')}</dt>
              <dd>{notes.length}</dd>
            </div>
            {!picked && (
              <div>
                <dt>{t('tallyLines')}</dt>
                <dd>{lines.length}</dd>
              </div>
            )}
            <div>
              <dt>{t('tallyFirst')}</dt>
              <dd>{d.short(notes[notes.length - 1]!.date)}</dd>
            </div>
          </dl>
        </div>
        {lines.length > 0 && (
          <nav className="notes-chips fnw-enter" style={delay(3)} aria-label={t('filter')}>
            <Link
              className="notes-chip notes-chip--all"
              href={notesHref}
              aria-current={picked ? undefined : 'page'}
            >
              {t('all')} <small>{all.length}</small>
            </Link>
            {lines.map((project) => (
              <Link
                key={project.slug}
                className="notes-chip"
                href={{ pathname: notesHref, query: { line: project.slug } }}
                aria-current={picked?.slug === project.slug ? 'page' : undefined}
                style={{ '--c': noteColour(project) } as React.CSSProperties}
              >
                <span className="line-no" aria-hidden="true">
                  {lineNumber(project.line)}
                </span>
                {project.name}{' '}
                <small>{all.filter((note) => note.project?.slug === project.slug).length}</small>
              </Link>
            ))}
          </nav>
        )}
      </header>

      {await NotesLog({ notes, locale, colour: picked ? noteColour(picked) : undefined })}
      <NotesMotion key={picked?.slug ?? ''} />
    </div>
  )
}
