import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { SectionHeading } from '@/components/fnw'
import { Lockup } from '@/components/site/Chrome'
import { Board } from '@/components/site/Signs'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { pageMetadata } from '@/lib/metadata'
import { getProjects, getStudio } from '@/lib/payload'

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

/**
 * The origin (docs/vision.html): the lockup and one sentence, then every project. The route map
 * joins the hero in the next step of the build order; for now the board carries the lines.
 */
export default async function Home({ params }: Props) {
  const locale = asLocale((await params).locale)
  const [t, studio, projects] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getStudio(locale),
    getProjects(locale),
  ])

  return (
    <>
      <section className="fnw-hero home-hero">
        <div className="fnw-hero__text">
          <span className="fnw-enter" style={{ '--i': 0 } as React.CSSProperties}>
            <Lockup size={48} full />
          </span>
          <p className="fnw-kicker fnw-enter" style={{ '--i': 1 } as React.CSSProperties}>
            {t('kicker')}
          </p>
          <h1 className="fnw-hero__title fnw-enter" style={{ '--i': 2 } as React.CSSProperties}>
            {studio.headline || 'Fromnowhere'}
          </h1>
          {studio.lede && (
            <p className="fnw-hero__lede fnw-enter" style={{ '--i': 3 } as React.CSSProperties}>
              {studio.lede}
            </p>
          )}
        </div>
      </section>

      <section className="home-section" aria-labelledby="projects">
        <SectionHeading
          number="01"
          kicker={t('boardKicker')}
          title={t('boardTitle')}
          id="projects"
        />
        {projects.length > 0 ? (
          <div className="fnw-reveal">
            <Board projects={projects} locale={locale} />
          </div>
        ) : (
          <p className="fnw-muted">{t('empty')}</p>
        )}
      </section>

      <section className="fnw-band home-band">
        <p className="fnw-kicker">{t('contactKicker')}</p>
        <h2>{t('contactTitle')}</h2>
        <p>{t('contactLead')}</p>
        <div>
          <Link className="fnw-btn fnw-btn--primary" href="/contact">
            {t('contactAction')}
          </Link>
        </div>
      </section>
    </>
  )
}
