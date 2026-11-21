import { getFormatter, getTranslations } from 'next-intl/server'
import type React from 'react'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { noteHref, notesHref } from '@/lib/links'
import { NOTE_TIME_ZONE, type NoteProject, type NoteSign } from '@/lib/notes'
import { lineColour } from '@/lib/routeMap'

/**
 * The notes' signs (docs/prototypes/notes.html): a note on a project's line wears that line's
 * number and colour; a note about the studio itself wears the point. notes.css styles them.
 */

/** A note's colour: its project's line, or the point's violet. */
export const noteColour = (project: NoteProject | null): string =>
  project ? lineColour(project.line) : 'var(--accent)'

const Arrow = () => (
  <svg
    className="notes-arrow"
    viewBox="0 0 256 256"
    fill="none"
    stroke="currentColor"
    strokeWidth="20"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M40 128h176M144 56l72 72-72 72" />
  </svg>
)

/** Whose note it is: "02 Giogio", or the point and "Fromnowhere". */
function Owner({ project, studio }: { project: NoteProject | null; studio: string }) {
  return project ? (
    <>
      <span className="line-no" aria-hidden="true">
        {lineNumber(project.line)}
      </span>
      {project.name}
    </>
  ) : (
    <>
      <span className="notes-point" aria-hidden="true" />
      {studio}
    </>
  )
}

/** The day, short ("20 Oct") and long ("20 October 2026"), in the page's language. */
async function dates(locale: Locale) {
  const format = await getFormatter({ locale })
  return {
    short: (iso: string) =>
      format.dateTime(new Date(iso), { day: 'numeric', month: 'short', timeZone: NOTE_TIME_ZONE }),
    weekday: (iso: string) =>
      format.dateTime(new Date(iso), { weekday: 'short', timeZone: NOTE_TIME_ZONE }),
    long: (iso: string) =>
      format.dateTime(new Date(iso), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: NOTE_TIME_ZONE,
      }),
    month: (iso: string) =>
      format.dateTime(new Date(iso), { month: 'long', year: 'numeric', timeZone: NOTE_TIME_ZONE }),
  }
}

export { dates as noteDates, Owner as NoteOwner, Arrow as NoteArrow }

/**
 * The log on /notes: a violet rail with one stop per note, lit in its line's colour, the newest at
 * the top and a heading at each month. NotesMotion runs a train down it; everything reads without.
 */
export async function NotesLog({
  notes,
  locale,
  colour,
}: {
  notes: NoteSign[]
  locale: Locale
  /** The rail's colour while one line is picked. */
  colour?: string
}) {
  const [t, d] = await Promise.all([getTranslations({ locale, namespace: 'notes' }), dates(locale)])
  const months: { label: string; notes: NoteSign[] }[] = []
  for (const note of notes) {
    const label = d.month(note.date)
    const last = months[months.length - 1]
    if (last?.label === label) last.notes.push(note)
    else months.push({ label, notes: [note] })
  }

  let i = 0
  return (
    <div
      className={`notes-log${colour ? ' is-filtered' : ''}`}
      style={colour ? ({ '--lc': colour } as React.CSSProperties) : undefined}
    >
      <span className="notes-log__rail" aria-hidden="true" />
      <span className="notes-log__train" aria-hidden="true" />
      {months.map((month) => (
        <section key={month.label} className="notes-log__month">
          <h2 className="notes-log__when" style={{ '--i': i } as React.CSSProperties}>
            <span>{month.label}</span>
          </h2>
          <ol className="notes-log__list">
            {month.notes.map((note) => (
              <li
                key={note.slug}
                className="notes-log__entry"
                style={{ '--c': noteColour(note.project), '--i': i++ } as React.CSSProperties}
              >
                <time className="notes-log__date" dateTime={note.date}>
                  {d.short(note.date)}
                  <small>{d.weekday(note.date)}</small>
                </time>
                <span className="notes-log__stop" aria-hidden="true">
                  <span className="notes-log__pulse" />
                  <span className="notes-log__core" />
                </span>
                <article className="notes-log__card">
                  <p className="notes-owner">
                    <Owner project={note.project} studio={t('studio')} />
                    <time className="notes-owner__when" dateTime={note.date}>
                      · {d.short(note.date)}
                    </time>
                  </p>
                  <h3>
                    <Link href={noteHref(note.slug)}>{note.title}</Link>
                  </h3>
                  <p>{note.summary}</p>
                </article>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

/** The three newest notes, on the home page under the departures board. */
export async function LatestNotes({ notes, locale }: { notes: NoteSign[]; locale: Locale }) {
  if (notes.length === 0) return null
  const [t, d] = await Promise.all([getTranslations({ locale, namespace: 'notes' }), dates(locale)])
  return (
    <section className="home__notes" id="notes" aria-labelledby="latest-notes">
      <div className="board notes-board">
        <div className="board__head">
          <div>
            <p className="board__kicker">{t('kicker')}</p>
            <h2 className="board__title" id="latest-notes">
              {t('latest')}
            </h2>
          </div>
          <Link className="notes-more" href={notesHref}>
            {t('allNotes')} <b>{notes.length}</b>
            <Arrow />
          </Link>
        </div>
        <ol className="notes-board__list">
          {notes.slice(0, 3).map((note, i) => (
            <li
              key={note.slug}
              className="notes-board__item"
              style={{ '--c': noteColour(note.project), '--i': i } as React.CSSProperties}
            >
              <p className="notes-owner">
                <Owner project={note.project} studio={t('studio')} />
                <time className="notes-owner__when" dateTime={note.date}>
                  · {d.short(note.date)}
                </time>
              </p>
              <h3>
                <Link href={noteHref(note.slug)}>{note.title}</Link>
              </h3>
              <p>{note.summary}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/** A project's own notes, under its page. */
export async function ProjectNotes({
  notes,
  project,
  locale,
}: {
  notes: NoteSign[]
  project: NoteProject
  locale: Locale
}) {
  if (notes.length === 0) return null
  const [t, d] = await Promise.all([getTranslations({ locale, namespace: 'notes' }), dates(locale)])
  const number = lineNumber(project.line)
  return (
    <section className="project-notes" aria-labelledby="project-notes">
      <p className="board__kicker">{t('projectKicker', { number })}</p>
      <h2 id="project-notes">{t('title')}</h2>
      <ol>
        {notes.map((note) => (
          <li key={note.slug}>
            <Link href={noteHref(note.slug)}>
              <time dateTime={note.date}>{d.long(note.date)}</time>
              <span className="project-notes__title">{note.title}</span>
              <Arrow />
              <span className="project-notes__summary">{note.summary}</span>
            </Link>
          </li>
        ))}
      </ol>
      {notes.length > 1 && (
        <Link className="notes-more" href={{ pathname: notesHref, query: { line: project.slug } }}>
          {t('onlyLine', { number })}
          <Arrow />
        </Link>
      )}
    </section>
  )
}
