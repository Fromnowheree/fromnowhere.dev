import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type React from 'react'

import { NoteArrow } from '@/components/site/Notes'
import { Proof, StartBand } from '@/components/site/Offer'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { lineNumber } from '@/lib/format'
import { capabilitiesHref, servicesHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getCapabilities, getPublishedIndex } from '@/lib/payload'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const [groups, t] = await Promise.all([
    getCapabilities(locale),
    getTranslations({ locale, namespace: 'capabilities' }),
  ])
  if (groups.length === 0) return {}
  return pageMetadata(locale, null, {
    title: t('title'),
    description: t('description'),
    path: capabilitiesHref,
  })
}

const delay = (i: number) => ({ '--i': i }) as React.CSSProperties

/**
 * The works: what is under every line, by area (design, build, security, operations). Each area
 * is a track under work lights and each capability a stop on it, with where it is built in:
 * this site, a project's line, or both. Absent (404) while no capability is published.
 */
export default async function CapabilitiesPage({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [groups, index, t, tHome] = await Promise.all([
    getCapabilities(locale),
    getPublishedIndex(),
    getTranslations({ locale, namespace: 'capabilities' }),
    getTranslations({ locale, namespace: 'home' }),
  ])
  if (groups.length === 0) notFound()

  const count = groups.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className="works-page">
      <header className="page-head notes-head">
        <p className="kicker fnw-enter" style={delay(0)}>
          {t('kicker')}
        </p>
        <h1 className="fnw-enter" style={delay(1)}>
          {t('title')}
          <span className="hero__point" aria-hidden="true" />
        </h1>
        <div className="notes-head__row">
          <p className="page-head__lead fnw-enter" style={delay(2)}>
            {t('lead')}
          </p>
          <dl className="tally fnw-enter" style={delay(3)} aria-label={t('tally')}>
            <div>
              <dt>{t('tallyCapabilities')}</dt>
              <dd>{count}</dd>
            </div>
            <div>
              <dt>{t('tallyAreas')}</dt>
              <dd>{groups.length}</dd>
            </div>
          </dl>
        </div>
      </header>

      {groups.map((group, g) => (
        <section
          key={group.area}
          id={group.area}
          className="works fnw-reveal"
          aria-labelledby={`area-${group.area}`}
        >
          <header className="works__head">
            <span className="works__no" aria-hidden="true">
              {lineNumber(g + 1)}
            </span>
            <h2 id={`area-${group.area}`}>{t(`area.${group.area}`)}</h2>
            <p>{t(`areaLead.${group.area}`)}</p>
          </header>
          {/* role="list": VoiceOver drops list semantics under list-style: none. */}
          <ul className="works__stops" role="list">
            {group.items.map((item, i) => (
              <li key={item.id} className="works__stop" style={delay(i)}>
                <span className="works__lamp" aria-hidden="true" />
                <h3>{item.title}</h3>
                <p>{item.text}</p>
                <Proof
                  label={t('proof')}
                  proof={item.proof}
                  thisSite={item.onThisSite ? t('thisSite') : null}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {index.services && (
        <p className="services-page__more">
          <Link className="notes-more" href={servicesHref}>
            {t('services')}
            <NoteArrow />
          </Link>
        </p>
      )}

      <StartBand
        kicker={tHome('contactKicker')}
        title={tHome('contactTitle')}
        lead={tHome('contactLead')}
        action={tHome('contactAction')}
      />
    </div>
  )
}
