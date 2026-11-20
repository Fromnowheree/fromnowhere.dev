import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import type React from 'react'

import { JsonLd } from '@/components/JsonLd'
import { RichText } from '@/components/RichText'
import { ProjectNotes } from '@/components/site/Notes'
import { ExitPlate, StatusTag } from '@/components/site/Signs'
import { Roundel } from '@/components/site/Offer'
import { Window } from '@/components/site/Window'
import { Link } from '@/i18n/navigation'
import { asLocale } from '@/i18n/server'
import { lineNumber } from '@/lib/format'
import { displayAddress, projectHref, serviceHref } from '@/lib/links'
import { pageMetadata } from '@/lib/metadata'
import { getNotes, getProject, getPublishedIndex, getServices } from '@/lib/payload'
import { lineColour } from '@/lib/routeMap'
import { serviceOf } from '@/lib/status'
import { projectNode } from '@/lib/structuredData'

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
 * One project (docs/vision.html, "One page per project"), on its own line: the page takes the
 * line's colour, and its hero draws a short trip from the point to this terminal (dashed past the
 * frontier while it is being built). Then its case study (up to four chapters, stops down the
 * line: the brief, what was built, under the surface, where it stands; with only "what was built"
 * it is plain text), a window onto the destination in its own look, an exit for every address,
 * lit in the line's colour, the facts (who it is for, the studio's part, the services it proves,
 * the stack), and its notes.
 */
const CHAPTERS = ['brief', 'story', 'engineering', 'outcome'] as const

/**
 * Whether a rich-text field has anything in it: an emptied editor leaves one empty paragraph. A
 * node with no children of its own (a picture, a rule) is something.
 */
const written = (value: unknown): boolean => {
  const children = (value as { root?: { children?: { children?: unknown }[] } } | null)?.root
    ?.children
  return Boolean(
    children?.some((node) => !Array.isArray(node.children) || node.children.length > 0),
  )
}

export default async function ProjectPage({ params }: Props) {
  const { locale: raw, slug } = await params
  const locale = asLocale(raw)
  const [project, index, t, tKind, tStatus, tBoard, tMap, format, notes, services] =
    await Promise.all([
      getProject(slug, locale),
      getPublishedIndex(),
      getTranslations({ locale, namespace: 'project' }),
      getTranslations({ locale, namespace: 'kind' }),
      getTranslations({ locale, namespace: 'status' }),
      getTranslations({ locale, namespace: 'board' }),
      getTranslations({ locale, namespace: 'map' }),
      getFormatter({ locale }),
      getNotes(locale),
      getServices(locale),
    ])
  if (!project) notFound()

  const addresses = project.addresses ?? []
  const started = project.started
    ? format.dateTime(new Date(project.started), { month: 'long', year: 'numeric' })
    : null
  const status = serviceOf(project)
  const quiet = new Set(project.unanswered ?? [])
  const chapters = CHAPTERS.filter((name) => written(project[name]))
  // The services this project is proof of, as the services page letters them.
  const proves = services.filter((service) =>
    service.proof.some((proof) => proof.slug === project.slug),
  )
  const scope = project.scope ?? []

  return (
    <article className="project" style={{ '--c': lineColour(project.line) } as React.CSSProperties}>
      <JsonLd
        data={projectNode({
          locale,
          path: projectHref(slug),
          name: project.name,
          summary: project.summary,
          address: addresses[0]?.url,
          started: project.started,
          stack: project.stack ?? [],
        })}
      />
      <header className="page-head">
        <p className="kicker fnw-enter" style={{ '--i': 0 } as React.CSSProperties}>
          {t('line', { number: lineNumber(project.line) })} · {tKind(project.kind)}
        </p>
        <h1 className="fnw-enter" style={{ '--i': 1 } as React.CSSProperties}>
          {project.name}
        </h1>
        <p className="page-head__lead fnw-enter" style={{ '--i': 2 } as React.CSSProperties}>
          {project.summary}
        </p>
        <div className="project__status fnw-enter" style={{ '--i': 3 } as React.CSSProperties}>
          <StatusTag status={status} label={tStatus(status)} />
          <span className="project__sub">{tBoard(`sub.${status}`)}</span>
        </div>
        {/* The trip from the point to this terminal: decoration, the words above say it all. */}
        <div className={`trip trip--${status}`} aria-hidden="true">
          <span className="trip__origin">
            <span className="trip__ring" />
          </span>
          <span className="trip__track">
            <span className="trip__line" />
            <span className="trip__rest" />
            <span className="trip__work">
              <i />
              <i />
              <b />
            </span>
            <span className="trip__train" />
          </span>
          <span className="trip__terminal">
            <span className="trip__pulse" />
          </span>
          <span className="trip__label trip__label--from">{tMap('origin')}</span>
          <span className="trip__label trip__label--to">
            {addresses.length > 0 ? displayAddress(addresses[0].url) : tBoard('here')}
          </span>
        </div>
      </header>

      <div className="project__body">
        {chapters.length > 1 ? (
          // role="list": VoiceOver drops list semantics under list-style: none.
          <ol className="chapters" role="list" aria-label={t('chapters')}>
            {chapters.map((name, i) => (
              <li
                key={name}
                className="chapter fnw-reveal"
                style={{ '--i': i } as React.CSSProperties}
              >
                <span className="chapter__stop" aria-hidden="true" />
                <h2>
                  <span className="chapter__no" aria-hidden="true">
                    {lineNumber(i + 1)}
                  </span>
                  {t(`chapter.${name}`)}
                </h2>
                <RichText data={project[name]} locale={locale} index={index} />
              </li>
            ))}
          </ol>
        ) : (
          <div className="project__story">
            <RichText data={project[chapters[0] ?? 'story']} locale={locale} index={index} />
          </div>
        )}

        <aside className="project__facts">
          {/* Look through the window, then go out the door. */}
          {await Window({ project, locale })}
          <section aria-label={t('addresses')} className="project__exits">
            {addresses.length > 0 ? (
              addresses.map((address) => (
                <ExitPlate
                  key={address.id ?? address.url}
                  href={address.url}
                  label={address.label}
                  quiet={quiet.has(address.url)}
                  locale={locale}
                />
              ))
            ) : (
              <p className="project__none">{t('noAddress')}</p>
            )}
          </section>
          <dl className="facts">
            {project.client && (
              <div>
                <dt>{t('madeFor')}</dt>
                <dd>{project.client}</dd>
              </div>
            )}
            {scope.length > 0 && (
              <div>
                <dt>{t('scope')}</dt>
                <dd className="facts__tags">
                  {scope.map((item) => (
                    <span key={item} className="facts__tag">
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {proves.length > 0 && (
              <div>
                <dt>{t('services')}</dt>
                <dd className="facts__services">
                  {proves.map((service) => (
                    <Link key={service.slug} href={serviceHref(service.slug)}>
                      <Roundel letter={service.letter} />
                      {service.name}
                    </Link>
                  ))}
                </dd>
              </div>
            )}
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
                    <span key={item} className="facts__tag">
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </dl>
        </aside>
      </div>

      {await ProjectNotes({
        notes: notes.filter((note) => note.project?.slug === project.slug),
        project: { slug, name: project.name, line: project.line },
        locale,
      })}

      <p className="project__back">
        <Link className="back" href="/#projects">
          <span aria-hidden="true">←</span>
          <span className="back__rail" aria-hidden="true" />
          {t('allProjects')}
        </Link>
      </p>
    </article>
  )
}
