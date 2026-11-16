import { getTranslations } from 'next-intl/server'

import { Icon } from '@/components/fnw'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { displayAddress, projectHref } from '@/lib/links'
import { destinationOf } from '@/lib/payload'
import type { Project } from '@/payload-types'

/**
 * A project's status as a tag: an icon and a word, never colour alone (design/README.md).
 * Running is a filled dot in `success`; anything still on its way is an open ring in `warning`.
 */
export async function StatusTag({ status, locale }: { status: Project['status']; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'status' })
  const running = status === 'running'
  return (
    <span className={`fnw-tag fnw-tag--${running ? 'success' : 'warning'} status-tag`}>
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden focusable="false">
        <circle
          cx="8"
          cy="8"
          r={running ? 4 : 3.5}
          fill={running ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={running ? 0 : 1.75}
        />
      </svg>
      {t(status)}
    </span>
  )
}

/**
 * An exit sign: every link that leaves fromnowhere.dev is one (docs/vision.html, "Exit plates").
 * An arrow, the address as a sign shows it, and a plain note that it leaves the site.
 */
export async function ExitPlate({
  href,
  label,
  locale,
}: {
  href: string
  label?: string | null
  locale: Locale
}) {
  const t = await getTranslations({ locale, namespace: 'project' })
  return (
    <a className="exit" href={href} rel="noopener noreferrer">
      <span className="exit__arrow" aria-hidden>
        <Icon name="arrow-right" size={20} />
      </span>
      <span className="exit__main">
        <span className="exit__addr">{displayAddress(href)}</span>
        <span className="exit__note">{label || t('leaves')}</span>
      </span>
      <span className="exit__out" aria-hidden>
        <Icon name="arrow-up-right" size={16} />
      </span>
    </a>
  )
}

/** The departures board: every published project as a row, in line order. */
export async function Board({ projects, locale }: { projects: Project[]; locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'board' })
  return (
    <div className="board-wrap">
      <table className="board">
        <thead>
          <tr>
            <th scope="col">{t('line')}</th>
            <th scope="col">{t('destination')}</th>
            <th scope="col">{t('what')}</th>
            <th scope="col">{t('address')}</th>
            <th scope="col">{t('status')}</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const destination = destinationOf(project)
            return (
              <tr key={project.id} data-line={project.slug}>
                <td className="board__line">{lineNumber(project.line)}</td>
                <th scope="row" className="board__name">
                  <Link href={projectHref(project.slug ?? '')}>{project.name}</Link>
                </th>
                <td className="board__what">{project.summary}</td>
                <td className="board__addr">
                  {destination.external ? (
                    (project.addresses ?? []).map((address) => (
                      <div key={address.id ?? address.url}>{displayAddress(address.url)}</div>
                    ))
                  ) : (
                    <div className="board__here">{t('here')}</div>
                  )}
                </td>
                <td>
                  <StatusTag status={project.status} locale={locale} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
