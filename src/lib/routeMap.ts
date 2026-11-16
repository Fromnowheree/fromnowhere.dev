/**
 * The route map's geometry (Night transit, docs/prototypes/night-transit.html): pure numbers, no
 * React. The server draws the whole, finished map from this; the client only adds motion on top.
 *
 * Two layouts of the same lines, both rendered, one shown by a container query (routemap.css):
 *
 * - **wide**: the point on the left, one row per line to the right. The outer lines leave the
 *   point at 45° at once; inner ones first run a short trunk out of the point, so parallel
 *   diagonals never cross. Every corner is rounded. Terminals stand in a column at x = 780 of
 *   1200, with the lit label cards to their right.
 * - **tall** (a phone): the point at the top left, one lane per line going down, each line
 *   leaving its lane at 45° for its terminal. Terminals stand in a column, labels to the right.
 *
 * One to MAP.maxLines (12) lines; with more, or none, there is no map (the board lists them all).
 * Every number is rounded to 0.01. Label positions are percentages of the layout's box, so the
 * HTML labels sit on the SVG at any width.
 */

/** A line's live status (src/lib/status.ts): delayed is a running line whose terminal is not answering. */
export type LineState = 'running' | 'delayed' | 'building' | 'planned' | 'paused'

export const MAP = {
  maxLines: 12,
  stopsMax: 3, // stops drawn per line: one per address after the first, three at most
  /** How much of a line under construction is built, by layout (the rest is dashed). */
  built: { wide: 0.5, tall: 0.56 },
  wide: {
    width: 1200,
    origin: { x: 84 },
    terminalX: 780,
    margin: 75, // above the first row and below the last
    row: { few: 130, many: 112 }, // row pitch for up to six lines, and for more (summaries hidden)
    corner: 28,
    stroke: 6,
    terminal: 11,
    train: 22,
    labelGap: 30,
    dash: [6, 10],
    hazard: 26,
    light: { offset: 11, r: 3.4, far: 2.6 },
  },
  tall: {
    width: 360,
    origin: { x: 30, y: 34 },
    lane: 18, // between neighbouring lanes, shrunk so all lanes fit in `lanesMax`
    lanesMax: 96,
    reach: 26, // the last diagonal, from the rightmost lane to the terminals' column
    straightMin: 36,
    row: { few: 140, many: 110 },
    bottom: 70,
    corner: 12,
    stroke: 4.5,
    terminal: 8,
    train: 14,
    labelGap: 16,
    dash: [4, 7],
    hazard: 16,
    light: { offset: 9, r: 2.6, far: 2 },
  },
} as const

/** Line colours: a palette of six site tokens (--line-1 … --line-6), repeating after six. */
export const LINE_COLOURS = 6

/** A line's colour from its line number: 1 → var(--line-1), …, 7 → var(--line-1) again. */
export const lineColour = (line: number | null | undefined): string => {
  const n = Number.isFinite(line) && (line as number) >= 1 ? Math.floor(line as number) : 1
  return `var(--line-${((n - 1) % LINE_COLOURS) + 1})`
}

export type Point = { x: number; y: number }

/** A label's place over the layout, as percentages of its width and height. */
export type LabelBox = { left: number; top: number; width: number }

export type MapStop = Point & { label: { left: number; top: number } }

export type MapLine = {
  /** The SVG path, rounded corners included. */
  d: string
  /** Its length in user units. */
  length: number
  terminal: Point
  label: LabelBox
  /** Under construction: where the built part stops, and what stands at the frontier. */
  built: {
    length: number
    /** stroke-dasharray for the dashed part, blank until the frontier. */
    dashes: string
    /** stroke-dasharray for the blinking sodium segment just past the frontier. */
    hazard: string
    lights: (Point & { r: number })[]
  } | null
  /** Planned: the whole line dashed, nothing built yet. */
  dashes: string | null
  stops: MapStop[]
}

export type MapLayout = {
  width: number
  height: number
  stroke: number
  terminal: number
  train: number
  origin: Point
  /** "00 · the point", beside the origin. `align` says which side of `left` the text sits. */
  originLabel: { left: number; top: number; align: 'start' | 'end' }
  lines: MapLine[]
}

export type RouteMapGeometry = { wide: MapLayout; tall: MapLayout }

export type MapLineInput = { state: LineState; stops: number }

const r2 = (value: number): number => {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}
const pct = (value: number, of: number) => r2((value / of) * 100)

type P = readonly [number, number]
type Segment = { kind: 'L'; a: P; b: P } | { kind: 'Q'; a: P; c: P; b: P }

const dist = (a: P, b: P) => Math.hypot(b[0] - a[0], b[1] - a[1])

/** A polyline with every inner corner rounded by a quadratic curve of radius `r` at most. */
const roundedSegments = (points: P[], r: number): Segment[] => {
  const segments: Segment[] = []
  let at = points[0]
  for (let i = 1; i < points.length - 1; i++) {
    const [p0, p1, p2] = [points[i - 1], points[i], points[i + 1]]
    const l1 = dist(p0, p1)
    const l2 = dist(p1, p2)
    const rr = Math.min(r, l1 / 2, l2 / 2)
    const a: P = [p1[0] + ((p0[0] - p1[0]) / l1) * rr, p1[1] + ((p0[1] - p1[1]) / l1) * rr]
    const b: P = [p1[0] + ((p2[0] - p1[0]) / l2) * rr, p1[1] + ((p2[1] - p1[1]) / l2) * rr]
    segments.push({ kind: 'L', a: at, b: a }, { kind: 'Q', a, c: p1, b })
    at = b
  }
  segments.push({ kind: 'L', a: at, b: points[points.length - 1] })
  return segments
}

const quad = (s: Extract<Segment, { kind: 'Q' }>, t: number): P => {
  const u = 1 - t
  return [
    u * u * s.a[0] + 2 * u * t * s.c[0] + t * t * s.b[0],
    u * u * s.a[1] + 2 * u * t * s.c[1] + t * t * s.b[1],
  ]
}

const QUAD_STEPS = 32

/** A path's segments as a walkable list: its length, and the point at any length along it. */
const measure = (segments: Segment[]) => {
  // Each segment as short straight pieces: exact for lines, close for the corner curves.
  const pieces: { a: P; b: P; from: number; length: number }[] = []
  let total = 0
  for (const s of segments) {
    const points: P[] =
      s.kind === 'L'
        ? [s.a, s.b]
        : Array.from({ length: QUAD_STEPS + 1 }, (_, k) => quad(s, k / QUAD_STEPS))
    for (let k = 1; k < points.length; k++) {
      const length = dist(points[k - 1], points[k])
      pieces.push({ a: points[k - 1], b: points[k], from: total, length })
      total += length
    }
  }
  const at = (distance: number): Point => {
    const d = Math.min(Math.max(distance, 0), total)
    const piece = pieces.find((p) => d <= p.from + p.length) ?? pieces[pieces.length - 1]
    const t = piece.length === 0 ? 0 : (d - piece.from) / piece.length
    return {
      x: piece.a[0] + (piece.b[0] - piece.a[0]) * t,
      y: piece.a[1] + (piece.b[1] - piece.a[1]) * t,
    }
  }
  return { total, at }
}

const pathOf = (segments: Segment[]): string => {
  const n = (p: P) => `${r2(p[0])} ${r2(p[1])}`
  let d = `M${n(segments[0].a)}`
  for (const s of segments) d += s.kind === 'L' ? ` L${n(s.b)}` : ` Q${n(s.c)} ${n(s.b)}`
  return d
}

/** A dash pattern that is blank until `start`, then dashes `on off` to the end. */
export const dashedFrom = (start: number, total: number, [on, off]: readonly number[]): string => {
  const parts = [`0 ${r2(start)}`]
  for (let pos = start; pos < total; pos += on + off) parts.push(`${on} ${off}`)
  return `${parts.join(' ')} 0 ${r2(total)}`
}

type Layout = (typeof MAP)['wide'] | (typeof MAP)['tall']

/** The rest of a line once its points are known: length, frontier, stops' places. */
const finish = (
  layout: Layout,
  kind: 'wide' | 'tall',
  width: number,
  height: number,
  points: P[],
  input: MapLineInput,
  stopsAt: (count: number) => Point[],
  terminal: Point,
  label: LabelBox,
): MapLine => {
  const segments = roundedSegments(points, layout.corner)
  const { total, at } = measure(segments)
  let built: MapLine['built'] = null
  if (input.state === 'building') {
    const length = total * MAP.built[kind]
    const frontier = at(length)
    const before = at(length - 1)
    const after = at(length + 1)
    const tangent = { x: after.x - before.x, y: after.y - before.y }
    const norm = Math.hypot(tangent.x, tangent.y) || 1
    const normal = { x: -tangent.y / norm, y: tangent.x / norm }
    const far = at(length + (total - length) * 0.55)
    built = {
      length: r2(length),
      dashes: dashedFrom(length, total, layout.dash),
      hazard: `0 ${r2(length + 4)} ${layout.hazard} ${r2(total)}`,
      lights: [
        ...[-1, 1].map((side) => ({
          x: r2(frontier.x + normal.x * layout.light.offset * side),
          y: r2(frontier.y + normal.y * layout.light.offset * side),
          r: layout.light.r,
        })),
        { x: r2(far.x), y: r2(far.y), r: layout.light.far },
      ],
    }
  }
  const stops = stopsAt(Math.max(0, Math.min(Math.floor(input.stops), MAP.stopsMax))).map(
    (stop): MapStop => ({
      x: r2(stop.x),
      y: r2(stop.y),
      label:
        kind === 'wide'
          ? { left: pct(stop.x, width), top: pct(stop.y - 16, height) }
          : { left: pct(stop.x + 12, width), top: pct(stop.y, height) },
    }),
  )
  return {
    d: pathOf(segments),
    length: r2(total),
    terminal: { x: r2(terminal.x), y: r2(terminal.y) },
    label,
    built,
    dashes: input.state === 'planned' ? `${layout.dash[0]} ${layout.dash[1]}` : null,
    stops,
  }
}

const wideLayout = (lines: MapLineInput[]): MapLayout => {
  const L = MAP.wide
  const n = lines.length
  const pitch = n <= 6 ? L.row.few : L.row.many
  // The trunk an inner line runs before its diagonal, per rank from the outside.
  const lead = pitch * (80 / 130)
  const height = 2 * L.margin + (n - 1) * pitch
  const ox = L.origin.x
  const oy = height / 2
  const tx = L.terminalX
  const centre = (n - 1) / 2

  return {
    width: L.width,
    height: r2(height),
    stroke: L.stroke,
    terminal: L.terminal,
    train: L.train,
    origin: { x: ox, y: r2(oy) },
    originLabel: { left: pct(ox + 14, L.width), top: pct(oy + 44, height), align: 'end' },
    lines: lines.map((input, i) => {
      const ty = L.margin + i * pitch
      const dy = ty - oy
      const rank = Math.round(centre - Math.abs(i - centre))
      let points: P[]
      let runStart: number
      if (Math.abs(dy) < 1e-9) {
        points = [
          [ox, oy],
          [tx, ty],
        ]
        runStart = ox
      } else {
        const bend = ox + rank * lead
        runStart = bend + Math.abs(dy)
        points = [[ox, oy], ...(rank > 0 ? [[bend, oy] as P] : []), [runStart, ty], [tx, ty]]
      }
      const run = tx - runStart
      return finish(
        L,
        'wide',
        L.width,
        height,
        points,
        input,
        (m) =>
          Array.from({ length: m }, (_, k) => ({
            x: runStart + run * (0.2 + (0.7 * (k + 1)) / (m + 1)),
            y: ty,
          })),
        { x: tx, y: ty },
        {
          left: pct(tx + L.labelGap, L.width),
          top: pct(ty, height),
          width: r2(pct(L.width - tx - L.labelGap, L.width) + 2),
        },
      )
    }),
  }
}

const tallLayout = (lines: MapLineInput[]): MapLayout => {
  const L = MAP.tall
  const n = lines.length
  const lane = n > 1 ? Math.min(L.lane, L.lanesMax / (n - 1)) : L.lane
  const { x: ox, y: oy } = L.origin
  const tx = ox + (n - 1) * lane + L.reach
  const pitch = n <= 6 ? L.row.few : L.row.many
  const firstY = oy + (tx - ox) + L.straightMin
  const lastY = firstY + (n - 1) * pitch
  const height = lastY + L.bottom

  const terminals = lines.map((_, i) => firstY + i * pitch)
  return {
    width: L.width,
    height: r2(height),
    stroke: L.stroke,
    terminal: L.terminal,
    train: L.train,
    origin: { x: ox, y: oy },
    originLabel: { left: pct(ox + 18, L.width), top: pct(oy - 16, height), align: 'start' },
    lines: lines.map((input, i) => {
      const x = ox + (n - 1 - i) * lane
      const ty = terminals[i]
      const laneTop = oy + (x - ox)
      const laneBottom = ty - (tx - x)
      const points: P[] = [
        [ox, oy],
        ...(x > ox ? [[x, laneTop] as P] : []),
        [x, laneBottom],
        [tx, ty],
      ]
      // Stops sit on the lane, below the terminal above (so their labels clear its card).
      const lo = Math.max(laneTop + 10, i > 0 ? terminals[i - 1] + 30 : -Infinity)
      const hi = laneBottom - 8
      return finish(
        L,
        'tall',
        L.width,
        height,
        points,
        input,
        (m) =>
          hi - lo < 12 * m
            ? []
            : Array.from({ length: m }, (_, k) => ({ x, y: lo + ((hi - lo) * (k + 1)) / (m + 1) })),
        { x: tx, y: ty },
        {
          left: pct(tx + L.labelGap, L.width),
          top: pct(ty, height),
          width: pct(L.width - tx - L.labelGap, L.width),
        },
      )
    }),
  }
}

/** Both layouts for these lines (in line order), or null with none or more than MAP.maxLines. */
export const routeMap = (lines: MapLineInput[]): RouteMapGeometry | null => {
  if (lines.length < 1 || lines.length > MAP.maxLines) return null
  return { wide: wideLayout(lines), tall: tallLayout(lines) }
}

/**
 * How many trains a line runs: none on a line that is not built or not running (a delayed line's
 * trains are held), one creeping up to the frontier of a line under construction, two or three
 * (one per address) on a running one.
 */
export const trainsFor = (state: LineState, addresses: number): number =>
  state === 'running' ? Math.min(3, Math.max(2, addresses)) : state === 'building' ? 1 : 0

/** Each line's trains have their own pace, in user units per millisecond, by line number. */
const PACES = [0.15, 0.1, 0.125, 0.08, 0.11, 0.135] as const

/** How long one train takes from the point to the terminal, in ms. */
export const trainPeriod = (line: number, length: number): number => {
  const n = Number.isFinite(line) && line >= 1 ? Math.floor(line) : 1
  return Math.round(length / PACES[(n - 1) % PACES.length])
}
