import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type React from 'react'

import { JsonLd } from '@/components/JsonLd'
import { RichText } from '@/components/RichText'
import { NoteArrow } from '@/components/site/Notes'
import { Proof, Roundel, StartBand } from '@/components/site/Offer'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { capabilitiesHref, servicesHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getPublishedIndex, getServices } from '@/lib/payload'
import { servicesNode } from '@/lib/structuredData'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = asLocale((await params).locale)
  const [services, t] = await Promise.all([
    getServices(locale),
    getTranslations({ locale, namespace: 'services' }),
  ])
  if (services.length === 0) return {}
  return pageMetadata(locale, null, {
    title: t('title'),
    description: t('description'),
    path: servicesHref,
  })
}

const delay = (i: number) => ({ '--i': i }) as React.CSSProperties

/**
 * What the studio can be hired for: the services as stops down one rail, lettered in their order,
 * each with what is in it and the lines where it already runs, then the way to start a project.
 * Absent (404) while no service is published.
 */
export default async function ServicesPage({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [services, index, t] = await Promise.all([
    getServices(locale),
    getPublishedIndex(),
    getTranslations({ locale, namespace: 'services' }),
  ])
  if (services.length === 0) notFound()

  const lines = new Set(services.flatMap((service) => service.proof.map((project) => project.slug)))

  return (
    <div className="services-page">
      <JsonLd
        data={servicesNode({
          locale,
          services: services.map(({ name, summary, slug }) => ({ name, summary, slug })),
        })}
      />
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
              <dt>{t('tallyServices')}</dt>
              <dd>{services.length}</dd>
            </div>
            {lines.size > 0 && (
              <div>
                <dt>{t('tallyLines')}</dt>
                <dd>{lines.size}</dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {/* role="list": VoiceOver drops list semantics under list-style: none. */}
      <ol className="services" role="list" aria-label={t('list')}>
        {services.map((service, i) => (
          <li key={service.slug} id={service.slug} className="service fnw-reveal" style={delay(i)}>
            <div className="service__stop">
              <Roundel letter={service.letter} />
            </div>
            <div className="service__body">
              <p className="board__kicker">{t('service', { letter: service.letter })}</p>
              <h2>{service.name}</h2>
              <p className="service__summary">{service.summary}</p>
              <RichText data={service.text} locale={locale} index={index} />
              <Proof label={t('proof')} proof={service.proof} />
            </div>
          </li>
        ))}
      </ol>

      {index.capabilities && (
        <p className="services-page__more">
          <Link className="notes-more" href={capabilitiesHref}>
            {t('capabilities')}
            <NoteArrow />
          </Link>
        </p>
      )}

      <StartBand
        kicker={t('bandKicker')}
        title={t('bandTitle')}
        lead={t('bandLead')}
        action={t('bandAction')}
      />
    </div>
  )
}
