import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import type React from 'react'

import { JsonLd } from '@/components/JsonLd'
import { HomeMotion } from '@/components/site/HomeMotion'
import { LatestNotes, NoteArrow } from '@/components/site/Notes'
import { CapabilitiesBand, ServicesBand, StartBand } from '@/components/site/Offer'
import { RouteMap } from '@/components/site/RouteMap'
import { Board } from '@/components/site/Signs'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/metadata'
import {
  getCapabilities,
  getNotes,
  getProjects,
  getServedLocales,
  getServices,
  getShortLinks,
  getStudio,
} from '@/lib/payload'
import { serverUrl } from '@/lib/serverUrl'
import { serviceOf, type Service } from '@/lib/status'
import { studioGraph } from '@/lib/structuredData'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const studio = await getStudio(locale)
  return pageMetadata(locale, null, {
    title: studio.headline || 'Fromnowhere',
    // The description written for search results; the lede only reads on the page itself.
    description: studio.defaultDescription || studio.lede,
    path: '/',
    absoluteTitle: true,
  })
}

const delay = (d: number) => ({ '--d': d }) as React.CSSProperties

/**
 * The origin (Night transit, docs/prototypes/night-transit.html), and the studio's front page: the
 * headline whose full stop is the point, what the studio does and the way to start a project, the
 * tally, the route map (one coloured line per project, drawn out of the point on every visit, with
 * trains running), the departures board listing the same projects in the same order, the ticker
 * of short links, then what can be hired (the services, each with the lines it runs on), what is
 * under every line (the capabilities), the latest notes (once there are three), and the way to
 * get in touch. Everything is the CMS's: the studio's words, the published projects, services and
 * capabilities, the short links; the tally is counted from them.
 */
export default async function Home({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [t, studio, projects, shortLinks, notes, languages, services, capabilities] =
    await Promise.all([
      getTranslations({ locale, namespace: 'home' }),
      getStudio(locale),
      getProjects(locale),
      getShortLinks(),
      getNotes(locale),
      getServedLocales(),
      getServices(locale),
      getCapabilities(locale),
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
      <JsonLd
        data={studioGraph({
          description: studio.defaultDescription,
          email: studio.email,
          profiles: (studio.profiles ?? []).map((profile) => profile.url),
          languages,
        })}
      />
      <section className="hero" aria-labelledby="home-title">
        <p className="kicker enter" style={delay(0)}>
          {t('kicker')}
        </p>
        <h1 id="home-title" className="enter" style={delay(1)}>
          {headline}
          <span className="hero__point" aria-hidden="true" />
        </h1>
        <div className="hero__row">
          <div className="hero__pitch">
            {studio.lede && (
              <p className="hero__lede enter" style={delay(2)}>
                {studio.lede}
              </p>
            )}
            <p className="hero__actions enter" style={delay(3)}>
              <Link className="btn" href="/contact">
                {t('heroAction')}
                <NoteArrow />
              </Link>
              {services.length > 0 && (
                <Link className="hero__more" href="/#services">
                  {t('heroServices')}
                </Link>
              )}
            </p>
          </div>
          {projects.length > 0 && (
            <dl className="tally enter" style={delay(4)} aria-label={t('tally')}>
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

      {await ServicesBand({ services, locale })}

      {await CapabilitiesBand({ groups: capabilities, locale })}

      {await LatestNotes({ notes, locale })}

      <StartBand
        className="home-band"
        kicker={t('contactKicker')}
        title={t('contactTitle')}
        lead={t('contactLead')}
        action={t('contactAction')}
      />

      {/* Keyed on what the map draws: when the home page is fetched again in place (the brand
          link on /en) with a line changed (a delay, a new address), the island starts over on
          the new lines and trains instead of running only the ones it found first. */}
      <HomeMotion
        key={projects.map((p) => `${p.slug}:${serviceOf(p)}:${p.addresses?.length ?? 0}`).join('|')}
      />
    </div>
  )
}
