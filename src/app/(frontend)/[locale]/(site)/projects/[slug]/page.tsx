import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { MediaImage } from '@/components/MediaImage'
import { RichText } from '@/components/RichText'
import { ExitPlate, StatusTag } from '@/components/site/Signs'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { asMedia, lineNumber } from '@/lib/format'
import { displayAddress, projectHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getProject, getPublishedIndex } from '@/lib/payload'

type Props = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const project = await getProject(slug, locale)
  if (!project) return {}
  return pageMetadata(locale, project.meta, {
    title: project.name,
    description: project.summary,
    path: projectHref(slug),
  })
}

/**
 * One project (docs/vision.html, "One page per project"): what it is, its story, what it is built
 * with, a window onto the destination in its own look, and an exit plate for every address.
 */
export default async function ProjectPage({ params }: Props) {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const [project, index, t, tKind, format] = await Promise.all([
    getProject(slug, locale),
    getPublishedIndex(),
    getTranslations({ locale, namespace: 'project' }),
    getTranslations({ locale, namespace: 'kind' }),
    getFormatter({ locale }),
  ])
  if (!project) notFound()

  const addresses = project.addresses ?? []
  const window = asMedia(project.window)
  const started = project.started
    ? format.dateTime(new Date(project.started), { month: 'long', year: 'numeric' })
    : null

  return (
    <article className="project">
      <header className="page-head">
        <p className="fnw-kicker fnw-enter" style={{ '--i': 0 } as React.CSSProperties}>
          {t('line', { number: lineNumber(project.line) })} · {tKind(project.kind)}
        </p>
        <h1 className="fnw-enter" style={{ '--i': 1 } as React.CSSProperties}>
          {project.name}
        </h1>
        <p className="page-head__lead fnw-enter" style={{ '--i': 2 } as React.CSSProperties}>
          {project.summary}
        </p>
        <div className="project__status fnw-enter" style={{ '--i': 3 } as React.CSSProperties}>
          <StatusTag status={project.status} locale={locale} />
        </div>
      </header>

      <div className="project__body">
        <div className="project__story">
          <RichText data={project.story} locale={locale} index={index} />
        </div>

        <aside className="project__facts">
          <section aria-label={t('addresses')} className="project__exits">
            {addresses.length > 0 ? (
              addresses.map((address) => (
                <ExitPlate
                  key={address.id ?? address.url}
                  href={address.url}
                  label={address.label}
                  locale={locale}
                />
              ))
            ) : (
              <p className="fnw-muted">{t('noAddress')}</p>
            )}
          </section>
          <dl className="facts">
            {started && (
              <div>
                <dt>{t('started')}</dt>
                <dd>{started}</dd>
              </div>
            )}
            {(project.stack ?? []).length > 0 && (
              <div>
                <dt>{t('builtWith')}</dt>
                <dd className="facts__tags">
                  {project.stack!.map((item) => (
                    <span key={item} className="fnw-tag fnw-tag--neutral">
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      {window && (
        <figure className="window">
          <figcaption className="window__bar">
            <span>{addresses[0] ? displayAddress(addresses[0].url) : project.name}</span>
            <span>{lineNumber(project.line)}</span>
          </figcaption>
          <MediaImage media={window} sizes="(min-width: 1120px) 1072px, 100vw" />
          {project.windowCaption && <p className="window__caption">{project.windowCaption}</p>}
        </figure>
      )}

      <p>
        <Link href="/#projects">← {t('allProjects')}</Link>
      </p>
    </article>
  )
}
