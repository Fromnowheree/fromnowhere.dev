import { getTranslations } from 'next-intl/server'
import type React from 'react'

import { NoteArrow } from '@/components/site/Notes'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { capabilitiesHref, projectHref, serviceHref, servicesHref } from '@/lib/links'
import type { CapabilitySign, ProofProject, ServiceSign } from '@/lib/payload'
import type { CapabilityArea } from '@/collections/Capabilities'
import { lineColour } from '@/lib/routeMap'

/**
 * What the studio offers, in the station's own signs (offer.css): services are lettered A, B, C
 * and name the lines they already run on; capabilities are the works under every line, lit like
 * work lights. Proof is always a published project's line, in that line's colour, or this site
 * itself, which wears the point.
 */

const colour = (line: number) => ({ '--c': lineColour(line) }) as React.CSSProperties

/**
 * The proof behind a service or a capability: a chip per line, each a link to that project's page, and the
 * point for this site. Renders nothing when there is no proof to show.
 */
export function Proof({
  label,
  proof,
  thisSite,
}: {
  /** What the chips are, e.g. "Built into". */
  label: string
  proof: ProofProject[]
  /** The name of this site's own chip, when the thing is built into this site. */
  thisSite?: string | null
}) {
  if (proof.length === 0 && !thisSite) return null
  return (
    <div className="proof">
      <span className="proof__label">{label}</span>
      {/* role="list": VoiceOver drops list semantics under list-style: none. */}
      <ul className="proof__chips" role="list">
        {thisSite && (
          <li>
            <span className="proof__chip proof__chip--here">
              <span className="notes-point" aria-hidden="true" />
              {thisSite}
            </span>
          </li>
        )}
        {proof.map((project) => (
          <li key={project.slug}>
            <Link
              className="proof__chip"
              href={projectHref(project.slug)}
              style={colour(project.line)}
            >
              <span className="line-no">{lineNumber(project.line)}</span>
              {project.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A service's letter in a lit ring, like the sign over a platform. */
export function Roundel({ letter }: { letter: string }) {
  return (
    <span className="roundel" aria-hidden="true">
      {letter}
    </span>
  )
}

/**
 * The services on the home page, under the departures board: one platform sign per service, with
 * a short track for each line it runs on. A card is one link to its section of /services.
 */
export async function ServicesBand({
  services,
  locale,
}: {
  services: ServiceSign[]
  locale: Locale
}) {
  if (services.length === 0) return null
  const [t, tServices] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'services' }),
  ])
  return (
    <section className="offer" id="services" aria-labelledby="services-title">
      <div className="offer__head">
        <div>
          <p className="board__kicker">{t('servicesKicker')}</p>
          <h2 className="board__title" id="services-title">
            {t('servicesTitle')}
          </h2>
          <p className="offer__lead">{t('servicesLead')}</p>
        </div>
        <Link className="notes-more" href={servicesHref}>
          {t('servicesAll')} <b>{services.length}</b>
          <NoteArrow />
        </Link>
      </div>
      <ol className="offer__grid" role="list">
        {services.map((service, i) => (
          <li key={service.slug} className="sign" style={{ '--i': i } as React.CSSProperties}>
            <Roundel letter={service.letter} />
            <h3>
              <Link href={serviceHref(service.slug)}>
                <span className="fnw-sr">{tServices('service', { letter: service.letter })}: </span>
                {service.name}
              </Link>
            </h3>
            <p>{service.summary}</p>
            {service.proof.length > 0 && (
              <ul className="sign__tracks" aria-label={tServices('proof')} role="list">
                {service.proof.map((project) => (
                  <li key={project.slug} style={colour(project.line)}>
                    <span className="sign__track" aria-hidden="true">
                      <span className="sign__train" />
                    </span>
                    <span className="line-no">{lineNumber(project.line)}</span>
                    <span className="sign__name">{project.name}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * The capabilities on the home page: the four areas side by side, each a short list of what is
 * under every line, and the way to the page that proves them.
 */
export async function CapabilitiesBand({
  groups,
  locale,
}: {
  groups: { area: CapabilityArea; items: CapabilitySign[] }[]
  locale: Locale
}) {
  if (groups.length === 0) return null
  const [t, tWorks] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'capabilities' }),
  ])
  const count = groups.reduce((sum, group) => sum + group.items.length, 0)
  return (
    <section className="works-band" aria-labelledby="works-title">
      <div className="offer__head">
        <div>
          <p className="board__kicker">{t('capabilitiesKicker')}</p>
          <h2 className="board__title" id="works-title">
            {t('capabilitiesTitle')}
          </h2>
          <p className="offer__lead">{t('capabilitiesLead')}</p>
        </div>
        <Link className="notes-more" href={capabilitiesHref}>
          {t('capabilitiesAll')} <b>{count}</b>
          <NoteArrow />
        </Link>
      </div>
      <div className="works-band__grid">
        {groups.map((group, i) => (
          <section
            key={group.area}
            className="works-band__area"
            aria-labelledby={`works-${group.area}`}
          >
            <h3 id={`works-${group.area}`}>
              <span className="works__no" aria-hidden="true">
                {lineNumber(i + 1)}
              </span>
              {tWorks(`area.${group.area}`)}
            </h3>
            <ul role="list">
              {group.items.map((item) => (
                <li key={item.id}>{item.title}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}

/** The band that ends the services page: the contact band's rail, running into one action. */
export function StartBand({
  kicker,
  title,
  lead,
  action,
  className,
}: {
  /** A further class on the band, for a page that needs to find its own. */
  className?: string
  kicker: string
  title: string
  lead: string
  action: string
}) {
  return (
    <section className={className ? `band ${className}` : 'band'} aria-labelledby="band-title">
      <div>
        <p className="kicker">{kicker}</p>
        <h2 id="band-title">{title}</h2>
        <p className="band__lead">{lead}</p>
      </div>
      <div className="band__go">
        <span className="band__rail" aria-hidden="true">
          <span className="band__mover" />
        </span>
        <Link className="btn" href="/contact">
          {action}
          <NoteArrow />
        </Link>
      </div>
    </section>
  )
}
