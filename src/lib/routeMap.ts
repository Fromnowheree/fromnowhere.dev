/**
 * The route map's geometry (docs/phase-1.md, 2.2): pure numbers, no React.
 *
 * The lines leave the point as a parallel bundle drawn on the mark's grid. One map row is one
 * mark tall (64px), so one mark unit is 1px: a line is 3 units wide, lines sit 7 apart (the bar
 * plus the mark's 4-unit gap), and parts never touch (a 4-unit gap between the point and a line,
 * and between a line and its plate). The outer lines peel off first, at 45°, and every line ends
 * on its own row, where the run carries it on to the plate.
 *
 * Six lines at most: beyond six the map is the vertical rail at every width (drawn in CSS, no
 * SVG), and the board's rows no longer light the map (routemap.css keys its board rules on
 * `.map:not(.map--rail)` and writes them out for rows 1 to 6 only).
 *
 * Coordinates are px in the fan's own system: the point's right edge is x = 0 and its centre is
 * (−R, 32n), with R the point's radius. Starts left of x = 0 paint into the origin column through
 * `overflow: visible`.
 */
export const MAP = {
  row: 64, // = --space-section; one row is one mark tall, so one mark unit is 1px
  stroke: 3, // a mark bar is 3 units thick at this scale
  spacing: 7, // stroke + the mark's 4-unit gap
  gap: 4, // parts never touch: point↔line, line↔plate
  point: 32, // = --size-icon-xl, the origin disc's diameter (fixed, never grows)
  lead: 32, // straight trunk before the first bend
  runMin: 16, // shortest straight run inside the fan after the last bend
  dash: [7, 4], // 7 + 4 = 11, one mark plate thick
  wideMax: 6, // more lines than this: the rail at every width, and no board→map lighting
  stopsMax: 3, // decorative stops drawn per line
} as const

export type WideLine = {
  /** The SVG path, in fan coordinates. */
  d: string
  /** This line's own row of the fan: `0 ${64 i} ${W} 64`. */
  viewBox: string
  /** The run's `stroke-dashoffset`, so a dashed line's pattern carries on across the join. */
  runDashOffset: number
}

export type WideMap = { width: number; height: number; lines: WideLine[] }

/** Every number on the map is rounded to 0.01. */
const r2 = (value: number): number => {
  const rounded = Math.round(value * 100) / 100
  return Object.is(rounded, -0) ? 0 : rounded
}

const DASH_PERIOD = MAP.dash[0] + MAP.dash[1]

/**
 * The fan for n lines (1 ≤ n ≤ MAP.wideMax), or null outside that range (no lines, or the rail).
 * The fan is W wide and 64n tall; every line's path ends at (W, 64 i + 32.5), its row's centre.
 */
export const wideMap = (n: number): WideMap | null => {
  if (!Number.isInteger(n) || n < 1 || n > MAP.wideMax) return null

  const R = MAP.point / 2
  const Cy = (MAP.row / 2) * n
  // Half a pixel down when n is odd, so the bundle's horizontal strokes cover whole pixels.
  const oy = Cy + (n % 2 === 1 ? 0.5 : 0)
  const reach = R + MAP.gap
  const bendStep = MAP.spacing * (Math.SQRT2 - 1)

  const raw = Array.from({ length: n }, (_, i) => {
    const c = i - (n - 1) / 2
    const yb = oy + MAP.spacing * c
    const yr = MAP.row * i + MAP.row / 2 + 0.5
    const d = yr - yb
    const xs = -R + Math.sqrt(reach ** 2 - (yb - Cy) ** 2)
    const k = Math.round((n - 1) / 2 - Math.abs(c))
    const Bx = MAP.gap + MAP.lead + k * bendStep
    const Ex = Bx + Math.abs(d)
    return { yb, yr, d, xs, Bx, Ex }
  })

  const W = Math.ceil(Math.max(...raw.map((line) => r2(line.Ex)))) + MAP.runMin

  const lines = raw.map(({ yb, yr, d, xs, Bx, Ex }, i): WideLine => {
    const straight = Math.abs(d) < 1e-9
    const path = straight
      ? `M ${r2(xs)} ${r2(yb)} H ${W}`
      : `M ${r2(xs)} ${r2(yb)} H ${r2(Bx)} L ${r2(Ex)} ${r2(yr)} H ${W}`
    const fanLength = straight ? W - xs : Bx - xs + Math.SQRT2 * Math.abs(d) + (W - Ex)
    // The run starts at x = −1 (it overlaps the fan's end by one unit), so its pattern starts
    // where the fan's stands one unit before its end.
    const runDashOffset = r2((((fanLength - 1) % DASH_PERIOD) + DASH_PERIOD) % DASH_PERIOD)
    return { d: path, viewBox: `0 ${MAP.row * i} ${W} ${MAP.row}`, runDashOffset }
  })

  return { width: W, height: MAP.row * n, lines }
}

/**
 * Where a line's decorative stops sit along its run, as percentages: one stop per address after
 * the first, at most MAP.stopsMax, spread evenly (k / (m + 1) · 100 for k = 1..m).
 */
export const stopsFor = (addressCount: number): number[] => {
  const m = Math.max(0, Math.min(Math.floor(addressCount) - 1, MAP.stopsMax))
  return Array.from({ length: m }, (_, index) => r2(((index + 1) / (m + 1)) * 100))
}
