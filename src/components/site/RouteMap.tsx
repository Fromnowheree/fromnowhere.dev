import { getTranslations } from 'next-intl/server'

import { StatusIcon } from '@/components/site/Signs'
import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { displayAddress, projectHref } from '@/lib/links'
import { isRunning } from '@/lib/payload'
import { MAP, stopsFor, wideMap } from '@/lib/routeMap'
import type { Project } from '@/payload-types'

/**
 * The route map in the home hero (docs/phase-1.md, 2): the point, one line per project, and a
 * plate at the end of each line that opens the project's page here (never the destination: exit
 * plates stay the only way off the station).
 *
 * Server-rendered HTML plus `aria-hidden` SVG, with no client JavaScript and no `style`
 * attributes: lighting, the rail and the draw are all CSS (routemap.css). Up to six lines the
 * server draws the fan (src/lib/routeMap.ts) and CSS shows it on a wide container; with more, it
 * renders the rail only, and no SVG at all.
 *
 * One async component with synchronous children only, so `renderToStaticMarkup` renders it in the
 * tests. Every plate states its own status; nothing is invented, so there is no legend and no
 * placeholder line. With no projects it renders nothing.
 */
export async function RouteMap({ projects, locale }: { projects: Project[]; locale: Locale }) {
  if (projects.length === 0) return null

  const [tHome, tMap, tProject, tStatus, tBoard] = await Promise.all([
    getTranslations({ locale, namespace: 'home' }),
    getTranslations({ locale, namespace: 'map' }),
    getTranslations({ locale, namespace: 'project' }),
    getTranslations({ locale, namespace: 'status' }),
    getTranslations({ locale, namespace: 'board' }),
  ])

  const rail = projects.length > MAP.wideMax
  const geo = rail ? null : wideMap(projects.length)

  return (
    <nav className={`map${rail ? ' map--rail' : ''}`} aria-label={tHome('mapLabel')}>
      <div className="map__body">
        <div className="map__origin" aria-hidden="true">
          <span className="map__here">{tHome('origin')}</span>
          <span className="map__point" />
        </div>
        {/* role="list": VoiceOver drops list semantics under list-style: none. */}
        <ol className="map__lines" role="list">
          {projects.map((project, i) => {
            const addresses = project.addresses ?? []
            const line = geo?.lines[i]
            const number = lineNumber(project.line)
            return (
              <li
                key={project.id}
                className={`map-line${isRunning(project) ? '' : ' map-line--dashed'}`}
                data-line={project.slug}
              >
                {geo && line && (
                  <svg
                    className="map-line__fan"
                    width={geo.width}
                    height={MAP.row}
                    viewBox={line.viewBox}
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d={line.d} />
                  </svg>
                )}
                {geo && line && (
                  <svg
                    className="map-line__run"
                    height={MAP.row}
                    aria-hidden="true"
                    focusable="false"
                  >
                    <line
                      x1={-1}
                      y1={32.5}
                      x2="100%"
                      y2={32.5}
                      strokeDashoffset={line.runDashOffset}
                    />
                    {stopsFor(addresses.length).map((x) => (
                      <circle key={x} cx={`${x}%`} cy={32.5} r={4} />
                    ))}
                  </svg>
                )}
                <Link className="map-plate" href={projectHref(project.slug ?? '')}>
                  <span className="map-plate__num" aria-hidden="true">
                    {number}
                  </span>
                  <span className="fnw-sr">
                    {tProject('line', { number })}
                    {tMap('pause')}
                  </span>
                  <span className="map-plate__name">{project.name}</span>
                  <span className="fnw-sr">{tMap('pause')}</span>
                  <span className="map-plate__where">
                    {project.status !== 'running' ? (
                      <span className="map-plate__status">
                        <StatusIcon running={false} />
                        {tStatus(project.status)}
                      </span>
                    ) : addresses.length > 0 ? (
                      <>
                        <span className="map-plate__addr">{displayAddress(addresses[0].url)}</span>
                        {addresses.length > 1 && (
                          <span className="map-plate__more">
                            <span aria-hidden="true"> · </span>
                            <span className="fnw-sr">{tMap('pause')}</span>
                            {tMap('more', { count: addresses.length - 1 })}
                          </span>
                        )}
                      </>
                    ) : (
                      tBoard('here')
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </div>
    </nav>
  )
}
