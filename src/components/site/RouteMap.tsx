import { getTranslations } from 'next-intl/server'
import type React from 'react'

import { Link } from '@/i18n/navigation'
import type { Locale } from '@/i18n/locales'
import { lineNumber } from '@/lib/format'
import { displayAddress, projectHref } from '@/lib/links'
import {
  lineColour,
  routeMap,
  trainPeriod,
  trainsFor,
  type MapLayout,
  type MapLine,
} from '@/lib/routeMap'
import type { Project } from '@/payload-types'

type Kind = 'wide' | 'tall'

/** A further address as a stop's label: "prod.giogio.music" after "giogio.music" is "prod.". */
const stopLabel = (first: string, other: string): string => {
  const base = displayAddress(first)
  const shown = displayAddress(other)
  return shown.endsWith(`.${base}`) ? shown.slice(0, shown.length - base.length) : shown
}

const vars = (values: Record<string, string | number>) => values as React.CSSProperties

/** One layout of the map as SVG: casing, lines, stops, terminals, trains (still), the point. */
function MapSvg({
  kind,
  layout,
  projects,
}: {
  kind: Kind
  layout: MapLayout
  projects: Project[]
}) {
  const soft = `map-soft-${kind}`
  const halo = `map-halo-${kind}`
  return (
    <svg
      className={`map__svg map__svg--${kind}`}
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      data-train={layout.train}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* In user space: a straight line's box has no height, and a box filter would vanish. */}
        <filter
          id={soft}
          filterUnits="userSpaceOnUse"
          x={-60}
          y={-60}
          width={layout.width + 120}
          height={layout.height + 120}
        >
          <feGaussianBlur stdDeviation={kind === 'wide' ? 7 : 4} />
        </filter>
        <radialGradient id={halo}>
          <stop className="map__halo-in" offset="0" />
          <stop className="map__halo-mid" offset="0.4" />
          <stop className="map__halo-out" offset="1" />
        </radialGradient>
      </defs>

      <g className="map__casing">
        {layout.lines.map((line, i) => (
          <path key={projects[i].id} d={line.d} />
        ))}
      </g>

      {layout.lines.map((line, i) => (
        <MapLineGroup
          key={projects[i].id}
          line={line}
          index={i}
          project={projects[i]}
          layout={layout}
          soft={soft}
        />
      ))}

      <g className="map__origin">
        <circle
          className="origin__halo"
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={kind === 'wide' ? 70 : 40}
          fill={`url(#${halo})`}
        />
        <circle className="origin__ring" cx={layout.origin.x} cy={layout.origin.y} r={9} />
        <circle
          className="origin__ring origin__ring--late"
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={9}
        />
        <circle
          className="origin__core"
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={kind === 'wide' ? 12 : 9}
        />
        <circle
          className="origin__eye"
          cx={layout.origin.x}
          cy={layout.origin.y}
          r={kind === 'wide' ? 4.5 : 3.5}
        />
      </g>
    </svg>
  )
}

function MapLineGroup({
  line,
  index,
  project,
  layout,
  soft,
}: {
  line: MapLine
  index: number
  project: Project
  layout: MapLayout
  soft: string
}) {
  const state = project.status
  const drawn = line.built?.length ?? line.length
  const trains = trainsFor(state, project.addresses?.length ?? 0)
  const builtDash = line.built ? `${line.built.length} ${line.length}` : undefined
  const { x, y } = line.terminal
  return (
    <g
      className={`line line--${state}`}
      data-line={project.slug}
      data-state={state}
      data-length={line.length}
      data-built={line.built?.length}
      data-period={trainPeriod(project.line, line.length)}
      style={vars({
        '--c': lineColour(project.line),
        '--i': index,
        '--draw': drawn,
        '--gap': Math.ceil(line.length + 10),
      })}
    >
      {state !== 'planned' && (
        <>
          <path
            className="line__glow"
            d={line.d}
            filter={`url(#${soft})`}
            strokeDasharray={builtDash}
          />
          <path className="line__main" d={line.d} strokeDasharray={builtDash} />
        </>
      )}
      {(line.built?.dashes ?? line.dashes) && (
        <path
          className="line__rest"
          d={line.d}
          strokeDasharray={line.built?.dashes ?? line.dashes!}
        />
      )}
      {line.built && (
        <>
          <path className="line__hazard" d={line.d} strokeDasharray={line.built.hazard} />
          {line.built.lights.map((light, k) => (
            <circle
              key={k}
              className={`line__light line__light--${['a', 'b', 'far'][k]}`}
              cx={light.x}
              cy={light.y}
              r={light.r}
            />
          ))}
        </>
      )}
      {line.stops.map((stop) => (
        <circle
          key={`${stop.x} ${stop.y}`}
          className="line__stop"
          cx={stop.x}
          cy={stop.y}
          r={layout.stroke * 0.95}
        />
      ))}
      {trains > 0 && (
        // Still and unseen as served: the island (HomeMotion) runs them.
        <g className="line__trains">
          {Array.from({ length: trains }, (_, k) => (
            <g
              key={k}
              className="train"
              style={{
                strokeDasharray: `${layout.train} ${Math.ceil(line.length + layout.train * 2)}`,
              }}
            >
              <path className="train__halo" d={line.d} />
              <path className="train__body" d={line.d} />
              <path className="train__core" d={line.d} />
            </g>
          ))}
        </g>
      )}
      <circle className="line__pulse" cx={x} cy={y} r={layout.terminal} />
      <circle className="line__terminal" cx={x} cy={y} r={layout.terminal} />
      {state === 'running' && (
        <circle className="line__core" cx={x} cy={y} r={layout.terminal * 0.38} />
      )}
      <path className="line__hit" d={line.d} />
    </g>
  )
}

/**
 * The route map (Night transit): the glowing point, one coloured line per project, each to a lit
 * terminal whose label opens the project's page. The server renders it whole and finished, both
 * layouts (wide, and tall for a phone; routemap.css shows one by the map's width), so without
 * JavaScript it reads and every link works. The opening draw is CSS and plays whenever the map
 * appears; the island (HomeMotion) adds the trains, the arrival pulses and the lighting that links
 * the map and the board.
 *
 * For assistive technology the drawing is hidden: the board is the list of projects. What stays
 * is one link per line, named "Line 02, Giogio, Running".
 *
 * One async component with synchronous children only, so `renderToStaticMarkup` renders it in the
 * tests. With no projects, or more than the map can draw, it renders nothing.
 */
export async function RouteMap({ projects, locale }: { projects: Project[]; locale: Locale }) {
  const geometry = routeMap(
    projects.map((project) => ({
      state: project.status,
      stops: Math.max(0, (project.addresses?.length ?? 0) - 1),
    })),
  )
  if (!geometry) return null

  const [tMap, tProject, tStatus, tKind, tBoard] = await Promise.all([
    getTranslations({ locale, namespace: 'map' }),
    getTranslations({ locale, namespace: 'project' }),
    getTranslations({ locale, namespace: 'status' }),
    getTranslations({ locale, namespace: 'kind' }),
    getTranslations({ locale, namespace: 'board' }),
  ])
  const { wide, tall } = geometry
  const n = projects.length
  // Lines leave one after another; with many, the stagger tightens so the opening stays short.
  const stagger = n <= 6 ? 170 : Math.round(1000 / (n - 1))

  return (
    <nav
      // More than six lines stand closer together, so their cards drop the summary.
      className={n > 6 ? 'map map--dense' : 'map'}
      id="route-map"
      aria-label={tMap('label')}
      style={vars({ '--stagger': `${stagger}ms` })}
    >
      <div className="map__stage">
        <MapSvg kind="wide" layout={wide} projects={projects} />
        <MapSvg kind="tall" layout={tall} projects={projects} />
        <div className="map__labels">
          <span
            className="map__origin-label"
            aria-hidden="true"
            style={vars({
              '--wl': `${wide.originLabel.left}%`,
              '--wt': `${wide.originLabel.top}%`,
              '--tl': `${tall.originLabel.left}%`,
              '--tt': `${tall.originLabel.top}%`,
            })}
          >
            {tMap('origin')}
          </span>
          {(['wide', 'tall'] as const).flatMap((kind) =>
            geometry[kind].lines.flatMap((line, i) => {
              const addresses = projects[i].addresses ?? []
              return line.stops.map((stop, k) => (
                <span
                  key={`${kind}-${projects[i].id}-${k}`}
                  className={`map__stop-label map__stop-label--${kind}`}
                  aria-hidden="true"
                  data-line={projects[i].slug}
                  style={vars({ left: `${stop.label.left}%`, top: `${stop.label.top}%`, '--i': i })}
                >
                  {stopLabel(addresses[0].url, addresses[k + 1].url)}
                </span>
              ))
            }),
          )}
          {projects.map((project, i) => {
            const number = lineNumber(project.line)
            const addresses = project.addresses ?? []
            const state = project.status
            return (
              <div
                key={project.id}
                className={`term term--${state}`}
                data-line={project.slug}
                style={vars({
                  '--c': lineColour(project.line),
                  '--i': i,
                  '--wl': `${wide.lines[i].label.left}%`,
                  '--wt': `${wide.lines[i].label.top}%`,
                  '--ww': `${wide.lines[i].label.width}%`,
                  '--tl': `${tall.lines[i].label.left}%`,
                  '--tt': `${tall.lines[i].label.top}%`,
                  '--tw': `${tall.lines[i].label.width}%`,
                })}
              >
                <span className="term__no" aria-hidden="true">
                  {number}
                </span>
                <div className="term__body">
                  <div className="term__head">
                    <Link className="term__name" href={projectHref(project.slug ?? '')}>
                      <span className="fnw-sr">
                        {tProject('line', { number })}
                        {tMap('pause')}
                      </span>
                      {project.name}
                      <span className="fnw-sr">
                        {tMap('pause')}
                        {tStatus(state)}
                      </span>
                    </Link>
                    <span className="term__kind" aria-hidden="true">
                      {tKind(project.kind)}
                    </span>
                  </div>
                  <div className="term__addr" aria-hidden="true">
                    {addresses.length > 0 ? (
                      <>
                        {displayAddress(addresses[0].url)}
                        {addresses.length > 1 && (
                          <span className="term__more">
                            {' '}
                            {tMap('stops', { count: addresses.length - 1 })}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="term__later">
                        {state === 'running' ? tBoard('here') : tBoard(`sub.${state}`)}
                      </span>
                    )}
                  </div>
                  {project.summary && (
                    <p className="term__sum" aria-hidden="true">
                      {project.summary}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <p className="map__hint" aria-hidden="true">
        <span className="map__hint-point">{tMap('hintPoint')}</span>
        <span className="map__hint-tap">{tMap('hintTap')}</span>
      </p>
    </nav>
  )
}
