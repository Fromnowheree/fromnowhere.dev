import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type React from 'react'

import { HomeMotion } from '@/components/site/HomeMotion'
import { RouteMap } from '@/components/site/RouteMap'
import { Board } from '@/components/site/Signs'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/metadata'
import { getProjects, getShortLinks, getStudio } from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import { serviceOf, type Service } from '@/lib/status'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const studio = await getStudio(locale)
  return pageMetadata(locale, null, {
    title: studio.headline || 'Fromnowhere',
    description: studio.lede,
    path: '/',
    absoluteTitle: true,
  })
}

const delay = (d: number) => ({ '--d': d }) as React.CSSProperties

/**
 * The origin (Night transit, docs/prototypes/night-transit.html): the headline whose full stop is
 * the point, the tally, the route map (one coloured line per project, drawn out of the point on
 * every visit, with trains running), the departures board listing the same projects in the same
 * order, the ticker of short links, and the way to get in touch. Everything is the CMS's: the
 * studio's words, the published projects, the short links; the tally is counted from them.
 */
export default async function Home({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [t, studio, projects, shortLinks] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getStudio(locale),
    getProjects(locale),
    getShortLinks(),
  ])

  // The headline's own full stop gives way to the point.
  const headline = (studio.headline || 'Fromnowhere').replace(/[.。]\s*$/, '')
  const count = (...states: Service[]) =>
    projects.filter((project) => states.includes(serviceOf(project))).length
  const running = count('running')
  const delayed = count('delayed')
  const building = count('building', 'planned')
  const paused = count('paused')
  const tally = [
    { label: t('tallyLines'), count: projects.length },
    { label: t('tallyRunning'), count: running },
    ...(delayed > 0 ? [{ label: t('tallyDelayed'), count: delayed }] : []),
    ...(building > 0 || paused === 0 ? [{ label: t('tallyBuilding'), count: building }] : []),
    ...(paused > 0 ? [{ label: t('tallyPaused'), count: paused }] : []),
  ]

  return (
    <div className="home">
      <section className="hero" aria-labelledby="home-title">
        <p className="kicker enter" style={delay(0)}>
          {t('kicker')}
        </p>
        <h1 id="home-title" className="enter" style={delay(1)}>
          {headline}
          <span className="hero__point" aria-hidden="true" />
        </h1>
        <div className="hero__row">
          {studio.lede ? (
            <p className="hero__lede enter" style={delay(2)}>
              {studio.lede}
            </p>
          ) : (
            <span />
          )}
          {projects.length > 0 && (
            <dl className="tally enter" style={delay(3)} aria-label={t('tally')}>
              {tally.map(({ label, count }) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>

      {projects.length > 0 && (
        <section className="home__map">{await RouteMap({ projects, locale })}</section>
      )}

      <section className="home__board" aria-labelledby="projects">
        {projects.length > 0 ? (
          await Board({ projects, shortLinks, host: new URL(serverUrl).host, locale })
        ) : (
          <>
            <h2 id="projects" className="fnw-sr">
              {t('tallyLines')}
            </h2>
            <p className="home__empty">{t('empty')}</p>
          </>
        )}
      </section>

      <section className="band home-band" aria-labelledby="band-title">
        <div>
          <p className="kicker">{t('contactKicker')}</p>
          <h2 id="band-title">{t('contactTitle')}</h2>
          <p className="band__lead">{t('contactLead')}</p>
        </div>
        <div className="band__go">
          <span className="band__rail" aria-hidden="true">
            <span className="band__mover" />
          </span>
          <Link className="btn" href="/contact">
            {t('contactAction')}
            <svg
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
          </Link>
        </div>
      </section>

      <HomeMotion />
    </div>
  )
}
