import { getTranslations } from 'next-intl/server'
import type React from 'react'

import { Icon } from '@/components/fnw'
import { Clock } from '@/components/site/Clock'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { displayAddress, projectHref } from '@/lib/links'
import type { ShortLinkSign } from '@/lib/payload'
import { lineColour } from '@/lib/routeMap'
import { serviceOf, type LiveProject, type Service } from '@/lib/status'

type Status = Service

/**
 * The status icon on its own, in the current colour: a dot with a ring that pulses while running,
 * a ring blinking round a held dot while delayed (the line runs, its address is not answering), a
 * dashed ring that turns while being built, an open ring while planned, two bars while paused.
 * The motion is CSS (board.css) and stops under reduced motion.
 */
export function StatusIcon({ status }: { status: Status }) {
  return (
    <svg className="status__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {status === 'running' && (
        <>
          <circle className="status__pulse" cx="8" cy="8" r="4" />
          <circle cx="8" cy="8" r="4" fill="currentColor" />
        </>
      )}
      {status === 'delayed' && (
        <>
          <circle className="status__blink" cx="8" cy="8" r="5.5" />
          <circle cx="8" cy="8" r="2.5" fill="currentColor" />
        </>
      )}
      {status === 'building' && <circle className="status__spin" cx="8" cy="8" r="5" />}
      {status === 'planned' && <circle className="status__ring" cx="8" cy="8" r="4.5" />}
      {status === 'paused' && (
        <>
          <rect x="4.5" y="4" width="2.5" height="8" rx="1" fill="currentColor" />
          <rect x="9" y="4" width="2.5" height="8" rx="1" fill="currentColor" />
        </>
      )}
    </svg>
  )
}

/** A project's status: an icon and a word, never colour alone. Synchronous: callers translate. */
export function StatusTag({ status, label }: { status: Status; label: string }) {
  return (
    <span className={`status status--${status}`}>
      <StatusIcon status={status} />
      {label}
    </span>
  )
}

/**
 * An exit: every link that leaves fromnowhere.dev from a project's page is one, lit as a terminal
 * in the line's colour (`--c`, set by the page). The address as a sign shows it, and a plain note
 * that it leaves the site.
 */
export async function ExitPlate({
  href,
  label,
  quiet = false,
  locale,
}: {
  href: string
  label?: string | null
  /** The status check heard nothing from it: the exit says so, and still leads there. */
  quiet?: boolean
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'project' })
  return (
    <a className={quiet ? 'exit exit--quiet' : 'exit'} href={href} rel="noopener noreferrer">
      <span className="exit__terminal" aria-hidden="true" />
      <span className="exit__main">
        <span className="exit__addr">{displayAddress(href)}</span>
        <span className="exit__note">{label || t('leaves')}</span>
        {quiet && <span className="exit__quiet">{t('notAnswering')}</span>}
      </span>
      <span className="exit__out" aria-hidden="true">
        <Icon name="arrow-up-right" size={18} />
      </span>
    </a>
  )
}

const tick = (
  <span className="row__out" aria-hidden="true">
    ↗
  </span>
)

/**
 * The departures board: every published project as a row, in line order, the same order as the
 * map's lines. The board is the accessible list of the projects (the map's drawing is hidden from
 * assistive technology). With the island (HomeMotion) a row and its line light each other, and the
 * rows sweep in; the clock is the visitor's own time and shows only with JavaScript.
 */
export async function Board({
  projects,
  shortLinks,
  host,
  locale,
}: {
  projects: LiveProject[]
  shortLinks: ShortLinkSign[]
  /** The site's host as a sign shows it, e.g. "fromnowhere.dev". */
  host: string
  locale: Locale
}) {
  const [t, tStatus] = await Promise.all([
    getTranslations({ locale, namespace: 'board' }),
    getTranslations({ locale, namespace: 'status' }),
  ])

  const ticker = shortLinks.map(
    (link) =>
      `${host}/${link.alias} → ${link.external ? displayAddress(link.href) : t('tickerHere')}`,
  )
  const bold = (chunks: React.ReactNode) => <b>{chunks}</b>
  const tickerCopy = (
    <>
      {t.rich('tickerIntro', { b: bold })}
      {ticker.map((text) => (
        <span key={text}>
          <span className="ticker__sep"> · </span>
          {text}
        </span>
      ))}
      <span className="ticker__sep"> · </span>
      {t.rich('tickerOutro', { b: bold })}
      <span className="ticker__sep"> · </span>
    </>
  )
  // About 0.13 s a character keeps every ticker at the prototype's reading pace.
  const tickerLength = ticker.join(' · ').length + 90

  return (
    <div className="board" id="departures">
      <div className="board__head">
        <div>
          <p className="board__kicker">{t('kicker')}</p>
          <h2 className="board__title" id="projects">
            {t('title')}
          </h2>
        </div>
        <Clock label={t('clock')} />
      </div>
      <div className="board__cols" aria-hidden="true">
        <span>{t('line')}</span>
        <span>{t('destination')}</span>
        <span>{t('address')}</span>
        <span>{t('status')}</span>
      </div>
      {/* role="list": VoiceOver drops list semantics under list-style: none. */}
      <ol className="board__rows" role="list">
        {projects.map((project, i) => {
          const number = lineNumber(project.line)
          const addresses = project.addresses ?? []
          const href = projectHref(project.slug ?? '')
          const status = serviceOf(project)
          // Addresses not answering, said beside each; the first one's silence is the row's
          // status already when the line is delayed.
          const quiet = new Set(
            (project.unanswered ?? []).filter(
              (url) => !(status === 'delayed' && url === addresses[0]?.url),
            ),
          )
          return (
            <li
              key={project.id}
              className="row"
              data-line={project.slug}
              data-state={status}
              style={{ '--c': lineColour(project.line), '--i': i } as React.CSSProperties}
            >
              <span className="row__sweep" aria-hidden="true" />
              <span className="row__no">
                <span className="fnw-sr">{t('line')} </span>
                {number}
              </span>
              <div className="row__dest">
                <Link href={href}>{project.name}</Link>
                {project.summary && <p>{project.summary}</p>}
              </div>
              <div className="row__addr">
                {addresses.length > 0 ? (
                  addresses.map((address) => (
                    <a
                      key={address.id ?? address.url}
                      className={quiet.has(address.url) ? 'is-quiet' : undefined}
                      href={address.url}
                      rel="noopener noreferrer"
                    >
                      {displayAddress(address.url)}
                      {quiet.has(address.url) && <span className="row__quiet">{t('quiet')}</span>}
                      {tick}
                    </a>
                  ))
                ) : (
                  <Link href={href}>{`${host}${href}`}</Link>
                )}
              </div>
              <div className="row__stat">
                <StatusTag status={status} label={tStatus(status)} />
                <span className="row__sub">{t(`sub.${status}`)}</span>
              </div>
            </li>
          )
        })}
      </ol>
      {shortLinks.length > 0 && (
        <div className="ticker" aria-hidden="true">
          <div
            className="ticker__track"
            style={{ '--ticker-s': `${Math.round(tickerLength * 0.13)}s` } as React.CSSProperties}
          >
            <span className="ticker__copy">{tickerCopy}</span>
            <span className="ticker__copy">{tickerCopy}</span>
          </div>
        </div>
      )}
    </div>
  )
}
