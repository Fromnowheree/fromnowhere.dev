import type React from 'react'

/**
 * The hero's background (Night transit): tracks of light that leave the headline's full stop, the
 * point, and run off the screen, with trains setting out along them. One trunk straight to the
 * right edge, two tracks peeling up and three down, at 0° and 45° like the map's lines.
 *
 * It is decoration, hidden from assistive technology, and says nothing about the projects: every
 * track is the point's violet, never a line's colour (those belong to the map and the board).
 *
 * Three boxes, each placed by CSS anchor positioning (site.css) so no track ever runs behind text:
 * the trunk starts at the point; the tracks going up start right of the headline's box; the
 * tracks going down start right of the lede. Where anchors are not supported the boxes are not
 * shown. Inside each, the drawing is in units of the headline's size (100 units to 1em), so it
 * keeps its proportions from a phone to a wide screen.
 */

type P = readonly [number, number]

type Track = {
  /** The corners of the track, from where it leaves the trunk. */
  points: readonly P[]
  /** How brightly it is lit: the trunk most, the outermost tracks least. */
  tier: 1 | 2 | 3
  /** When it starts to draw, in ms after the page arrives. */
  at: number
  /** How long a train takes from one to the next, in seconds, and where in that it starts. */
  pace: number
  phase: number
  stops?: readonly P[]
}

/** Far enough that a track always reaches the edge of the window: 42em. */
const FAR = 4200
const CORNER = 46

/** A polyline as a path with every inner corner rounded. */
const path = (points: readonly P[]): string => {
  const parts = [`M${points[0][0]} ${points[0][1]}`]
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i - 1]
    const [x, y] = points[i]
    const [nx, ny] = points[i + 1]
    const before = Math.hypot(x - px, y - py)
    const after = Math.hypot(nx - x, ny - y)
    const r = Math.min(CORNER, before / 2, after / 2)
    const ax = x + ((px - x) / before) * r
    const ay = y + ((py - y) / before) * r
    const bx = x + ((nx - x) / after) * r
    const by = y + ((ny - y) / after) * r
    parts.push(`L${ax.toFixed(1)} ${ay.toFixed(1)}`, `Q${x} ${y} ${bx.toFixed(1)} ${by.toFixed(1)}`)
  }
  const last = points[points.length - 1]
  parts.push(`L${last[0]} ${last[1]}`)
  return parts.join('')
}

const TRUNK: Track[] = [
  {
    points: [
      [0, 0],
      [FAR, 0],
    ],
    tier: 1,
    at: 450,
    pace: 6.4,
    phase: 0,
    stops: [[330, 0]],
  },
]

/** The first to leave goes highest, so the two never cross. */
const UP: Track[] = [
  {
    points: [
      [0, 0],
      [24, 0],
      [199, -175],
      [FAR, -175],
    ],
    tier: 3,
    at: 800,
    pace: 9.6,
    phase: 3.1,
    stops: [[380, -175]],
  },
  {
    points: [
      [0, 0],
      [150, 0],
      [238, -88],
      [FAR, -88],
    ],
    tier: 2,
    at: 950,
    pace: 7.8,
    phase: 5.2,
  },
]

/** The first two turn down and leave through the foot of the hero, towards the route map. */
const DOWN: Track[] = [
  {
    points: [
      [0, 0],
      [16, 0],
      [156, 140],
      [156, FAR],
    ],
    tier: 3,
    at: 900,
    pace: 10.4,
    phase: 1.4,
  },
  {
    points: [
      [0, 0],
      [126, 0],
      [266, 140],
      [266, FAR],
    ],
    tier: 2,
    at: 1050,
    pace: 8.6,
    phase: 6.3,
  },
  {
    points: [
      [0, 0],
      [250, 0],
      [345, 95],
      [FAR, 95],
    ],
    tier: 2,
    at: 1200,
    pace: 7.2,
    phase: 2.7,
    stops: [[470, 95]],
  },
]

const vars = (values: Record<string, string>) => values as React.CSSProperties

function Tracks({ name, origin, tracks }: { name: string; origin: string; tracks: Track[] }) {
  return (
    <div className={`hero-art hero-art--${name}`} aria-hidden="true">
      <svg focusable="false">
        {/* The point is at this box's left edge, `origin` down from its top; 100 units to 1em. */}
        <svg
          x="0"
          y={origin}
          width="42em"
          height="42em"
          viewBox={`0 0 ${FAR} ${FAR}`}
          overflow="visible"
        >
          {tracks.map((track, i) => {
            const d = path(track.points)
            return (
              <g
                key={i}
                className={`hero-line hero-line--${track.tier}`}
                style={vars({
                  '--at': `${track.at}ms`,
                  '--pace': `${track.pace}s`,
                  '--phase': `${-track.phase}s`,
                })}
              >
                <path className="hero-line__casing" d={d} />
                <path className="hero-line__glow hero-line__glow--wide" d={d} />
                <path className="hero-line__glow" d={d} />
                <path className="hero-line__main" d={d} />
                {track.stops?.map(([x, y]) => (
                  <circle key={`${x} ${y}`} className="hero-line__stop" cx={x} cy={y} r={7} />
                ))}
                <path className="hero-line__halo" d={d} />
                <path className="hero-line__train" d={d} />
              </g>
            )
          })}
        </svg>
      </svg>
    </div>
  )
}

export function HeroLines() {
  return (
    <>
      <Tracks name="down" origin="0.5em" tracks={DOWN} />
      <Tracks name="up" origin="3em" tracks={UP} />
      <Tracks name="trunk" origin="0.5em" tracks={TRUNK} />
    </>
  )
}
