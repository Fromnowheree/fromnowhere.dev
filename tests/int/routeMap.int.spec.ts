import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { CARD_PALETTE, cardLineColour } from '@/lib/shareCard'

import {
  LINE_COLOURS,
  lineColour,
  MAP,
  routeMap,
  trainPeriod,
  trainsFor,
  type LineState,
  type MapLayout,
  type MapLineInput,
} from '@/lib/routeMap'

/**
 * The route map's geometry (src/lib/routeMap.ts) and the stylesheets of Night transit, without a
 * browser or a database: both layouts for one to twelve lines, every line leaving the point and
 * ending at its own terminal, never crossing another, its corners rounded on 45° and straight
 * runs; and the CSS keeps the rules AGENTS.md sets for colour and motion.
 */

type Point = { x: number; y: number }

/** A path ("M… L… Q…") flattened into points, the corner curves sampled finely. */
const pointsOf = (d: string): Point[] => {
  const tokens = d.match(/[MLQ]|-?[\d.]+/g) ?? []
  const points: Point[] = []
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]
    const read = () => Number(tokens[index++])
    if (command === 'M' || command === 'L') points.push({ x: read(), y: read() })
    else if (command === 'Q') {
      const a = points[points.length - 1]
      const c = { x: read(), y: read() }
      const b = { x: read(), y: read() }
      for (let k = 1; k <= 24; k++) {
        const t = k / 24
        const u = 1 - t
        points.push({
          x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
          y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
        })
      }
    } else throw new Error(`Unexpected path command ${command} in "${d}"`)
  }
  return points
}

/** The straight runs of a path ("L" segments), each from where the path stood. */
const straights = (d: string): [Point, Point][] => {
  const tokens = d.match(/[MLQ]|-?[\d.]+/g) ?? []
  const runs: [Point, Point][] = []
  let at: Point = { x: 0, y: 0 }
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]
    const read = () => Number(tokens[index++])
    if (command === 'M') at = { x: read(), y: read() }
    else if (command === 'L') {
      const next = { x: read(), y: read() }
      runs.push([at, next])
      at = next
    } else {
      read()
      read()
      at = { x: read(), y: read() }
    }
  }
  return runs
}

const lengthOf = (points: Point[]) =>
  points.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - points[i].x, p.y - points[i].y), 0)

/** Where a monotone polyline stands at `at` along one axis, by linear interpolation. */
const across = (points: Point[], axis: 'x' | 'y', at: number): number | null => {
  const other = axis === 'x' ? 'y' : 'x'
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]]
    if (at >= a[axis] - 1e-9 && at <= b[axis] + 1e-9) {
      if (Math.abs(b[axis] - a[axis]) < 1e-9) return Math.min(a[other], b[other])
      return a[other] + ((at - a[axis]) / (b[axis] - a[axis])) * (b[other] - a[other])
    }
  }
  return null
}

const states: LineState[] = ['running', 'running', 'building', 'running', 'planned', 'paused']
const inputs = (n: number): MapLineInput[] =>
  Array.from({ length: n }, (_, i) => ({ state: states[i % states.length], stops: i % 4 }))
const counts = Array.from({ length: MAP.maxLines }, (_, i) => i + 1)
const layouts = (n: number): [string, MapLayout][] => {
  const geometry = routeMap(inputs(n))!
  return [
    ['wide', geometry.wide],
    ['tall', geometry.tall],
  ]
}

describe('routeMap', () => {
  it('draws one line per project, from one to twelve, and nothing outside that', () => {
    expect(routeMap([])).toBeNull()
    expect(routeMap(inputs(MAP.maxLines + 1))).toBeNull()
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        expect(layout.lines, `${kind} n=${n}`).toHaveLength(n)
  })

  it('reproduces the prototype for the four seeded lines', () => {
    const { wide, tall } = routeMap([
      { state: 'running', stops: 0 },
      { state: 'running', stops: 2 },
      { state: 'building', stops: 0 },
      { state: 'running', stops: 0 },
    ])!
    expect([wide.width, wide.height, wide.origin]).toEqual([1200, 540, { x: 84, y: 270 }])
    expect(wide.lines.map((line) => line.terminal)).toEqual(
      [75, 205, 335, 465].map((y) => ({ x: 780, y })),
    )
    expect([tall.width, tall.height, tall.origin]).toEqual([360, 640, { x: 30, y: 34 }])
    expect(tall.lines.map((line) => line.terminal)).toEqual(
      [150, 290, 430, 570].map((y) => ({ x: 110, y })),
    )
    expect(wide.lines[1].stops).toHaveLength(2)
    expect(wide.lines[2].built?.length).toBeCloseTo(wide.lines[2].length * 0.5, 1)
  })

  it('starts every line at the point and ends it at its own terminal', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        for (const line of layout.lines) {
          const points = pointsOf(line.d)
          expect(points[0], `${kind} n=${n}`).toEqual(layout.origin)
          expect(points[points.length - 1], `${kind} n=${n}`).toEqual(line.terminal)
        }
  })

  it('stands the terminals in a column, in line order, inside the drawing', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n)) {
        const terminals = layout.lines.map((line) => line.terminal)
        expect(new Set(terminals.map((t) => t.x)).size, `${kind} n=${n}`).toBe(1)
        for (let i = 1; i < n; i++) expect(terminals[i].y).toBeGreaterThan(terminals[i - 1].y)
        for (const t of terminals) {
          expect(t.x).toBeLessThan(layout.width)
          expect(t.y).toBeGreaterThan(0)
          expect(t.y).toBeLessThan(layout.height)
        }
      }
  })

  it('runs straight only horizontally, vertically or at exactly 45°', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        for (const line of layout.lines)
          for (const [a, b] of straights(line.d)) {
            const dx = Math.abs(b.x - a.x)
            const dy = Math.abs(b.y - a.y)
            expect(dx < 0.02 || dy < 0.02 || Math.abs(dx - dy) < 0.03, `${kind} ${line.d}`).toBe(
              true,
            )
          }
  })

  it('never crosses two lines', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n)) {
        // Wide lines always move right, tall ones always move down: compare them along that axis.
        const axis = kind === 'wide' ? 'x' : 'y'
        const paths = layout.lines.map((line) => pointsOf(line.d))
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++)
            for (let at = 0; at <= (kind === 'wide' ? layout.width : layout.height); at += 2) {
              const a = across(paths[i], axis, at)
              const b = across(paths[j], axis, at)
              if (a === null || b === null) continue
              // Wide: an earlier line stays above a later one; tall: to its right.
              if (kind === 'wide')
                expect(a, `${kind} n=${n} ${i}×${j} at ${at}`).toBeLessThanOrEqual(b + 0.05)
              else expect(a, `${kind} n=${n} ${i}×${j} at ${at}`).toBeGreaterThanOrEqual(b - 0.05)
            }
      }
  })

  it('knows each line’s length', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        for (const line of layout.lines)
          expect(Math.abs(line.length - lengthOf(pointsOf(line.d))), `${kind}`).toBeLessThan(0.5)
  })

  it('builds a line under construction to its frontier, with work lights there', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        layout.lines.forEach((line, i) => {
          const state = inputs(n)[i].state
          expect(Boolean(line.built), `${kind} ${state}`).toBe(state === 'building')
          expect(line.dashes !== null).toBe(state === 'planned')
          if (!line.built) return
          const share = kind === 'wide' ? MAP.built.wide : MAP.built.tall
          expect(line.built.length).toBeCloseTo(line.length * share, 1)
          expect(line.built.dashes.startsWith(`0 ${line.built.length} `)).toBe(true)
          expect(
            line.built.hazard.startsWith(`0 ${Math.round((line.built.length + 4) * 100) / 100} `),
          ).toBe(true)
          const [a, b] = line.built.lights
          const offset = kind === 'wide' ? MAP.wide.light.offset : MAP.tall.light.offset
          // The two near lights stand either side of the line, the same distance off.
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeCloseTo(offset * 2, 1)
        })
  })

  it('keeps the stops a phone lane has room for, rather than none when not all fit', () => {
    const tall = (n: number) =>
      routeMap(Array.from({ length: n }, () => ({ state: 'running' as const, stops: 3 })))!.tall
    // The top lane is short (it ends at the first terminal): one stop, where it used to drop all.
    expect(tall(4).lines.map((line) => line.stops.length)).toEqual([1, 3, 3, 1])
    for (const line of tall(7).lines)
      for (let k = 1; k < line.stops.length; k++)
        expect(line.stops[k].y - line.stops[k - 1].y).toBeGreaterThanOrEqual(9)
  })

  it('puts a stop for each further address, three at most, on the line itself', () => {
    const wide = routeMap([{ state: 'running', stops: 9 }])!.wide
    expect(wide.lines[0].stops).toHaveLength(MAP.stopsMax)
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        layout.lines.forEach((line, i) => {
          expect(line.stops.length).toBeLessThanOrEqual(Math.min(inputs(n)[i].stops, MAP.stopsMax))
          if (kind === 'wide') expect(line.stops).toHaveLength(Math.min(inputs(n)[i].stops, 3))
          const points = pointsOf(line.d)
          for (const stop of line.stops) {
            const on = across(
              points,
              kind === 'wide' ? 'x' : 'y',
              kind === 'wide' ? stop.x : stop.y,
            )
            expect(on).toBeCloseTo(kind === 'wide' ? stop.y : stop.x, 1)
          }
        })
  })

  it('places each terminal’s label beside it, inside the box, without overlapping the next', () => {
    for (const n of counts)
      for (const [kind, layout] of layouts(n))
        layout.lines.forEach((line, i) => {
          expect(line.label.left).toBeCloseTo(
            ((line.terminal.x + (kind === 'wide' ? 30 : 16)) / layout.width) * 100,
            1,
          )
          expect(line.label.top).toBeCloseTo((line.terminal.y / layout.height) * 100, 1)
          expect(line.label.left + line.label.width).toBeLessThanOrEqual(102.01)
          if (i > 0) {
            // A card is at most ~62px tall without its summary; at the narrowest width each
            // layout is shown (700px wide, 320px tall) terminals stand further apart than that.
            const narrowest = kind === 'wide' ? 700 : 288
            const apart =
              ((line.terminal.y - layout.lines[i - 1].terminal.y) * narrowest) / layout.width
            expect(apart, `${kind} n=${n}`).toBeGreaterThanOrEqual(62)
          }
        })
  })

  it('rounds every number to 0.01', () => {
    for (const n of counts)
      for (const [, layout] of layouts(n))
        for (const line of layout.lines)
          for (const value of [
            ...(line.d.match(/-?[\d.]+/g) ?? []),
            line.length,
            line.label.left,
            line.label.top,
            line.label.width,
          ])
            expect(Number(value)).toBe(Math.round(Number(value) * 100) / 100)
  })
})

describe('lineColour', () => {
  it('takes the line’s colour from its number, through six tokens, then again', () => {
    expect(LINE_COLOURS).toBe(6)
    expect([1, 2, 3, 4, 5, 6, 7, 12, 13].map(lineColour)).toEqual(
      [1, 2, 3, 4, 5, 6, 1, 6, 1].map((k) => `var(--line-${k})`),
    )
    expect(lineColour(null)).toBe('var(--line-1)')
    expect(lineColour(0)).toBe('var(--line-1)')
  })
})

describe('trains', () => {
  it('run on a running line, creep on one under construction, and are absent otherwise', () => {
    expect(trainsFor('running', 1)).toBe(2)
    expect(trainsFor('running', 3)).toBe(3)
    expect(trainsFor('running', 6)).toBe(3)
    expect(trainsFor('building', 0)).toBe(1)
    expect(trainsFor('planned', 2)).toBe(0)
    expect(trainsFor('paused', 2)).toBe(0)
    // A delayed line's trains are held at the point until its address answers again.
    expect(trainsFor('delayed', 3)).toBe(0)
  })

  it('take longer on a longer line, each line at its own pace', () => {
    expect(trainPeriod(1, 1500)).toBeGreaterThan(trainPeriod(1, 750))
    expect(trainPeriod(1, 774)).not.toBe(trainPeriod(2, 774))
    expect(trainPeriod(7, 774)).toBe(trainPeriod(1, 774))
  })
})

describe('the stylesheets', () => {
  const dir = path.resolve(__dirname, '../../src/app/(frontend)/[locale]')
  const read = (name: string) =>
    readFileSync(path.join(dir, name), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const sheets = Object.fromEntries(
    ['site.css', 'routemap.css', 'board.css'].map((name) => [name, read(name)]),
  )

  /** Every declaration of a property, with the at-rules and selectors around it. */
  const declarations = (css: string, property: RegExp) => {
    const found: { value: string; within: string[] }[] = []
    const stack: string[] = []
    let start = 0
    for (let i = 0; i < css.length; i++) {
      const char = css[i]
      if (char === '{') {
        stack.push(css.slice(start, i).trim())
        start = i + 1
      } else if (char === '}') {
        stack.pop()
        start = i + 1
      } else if (char === ';') {
        const declaration = css.slice(start, i).trim()
        const match = declaration.match(/^([\w-]+)\s*:\s*([\s\S]*)$/)
        if (match && property.test(match[1])) found.push({ value: match[2], within: [...stack] })
        start = i + 1
      }
    }
    return found
  }

  it('moves nothing outside prefers-reduced-motion: no-preference', () => {
    for (const [name, css] of Object.entries(sheets)) {
      const animations = declarations(css, /^animation(-name)?$/)
      expect(animations.length, name).toBeGreaterThan(0)
      for (const { value, within } of animations) {
        if (value === 'none') continue
        expect(
          within.some((rule) => rule.startsWith('@media (prefers-reduced-motion: no-preference)')),
          `${name}: animation ${value} in ${within.join(' › ')}`,
        ).toBe(true)
      }
    }
  })

  it('plays the home page’s opening on every visit: never keyed on fnw-calm', () => {
    const map = sheets['routemap.css']
    expect(map).not.toContain('fnw-calm')
    expect(sheets['board.css']).not.toContain('fnw-calm')
    const draws = declarations(map, /^animation$/).filter(({ value }) =>
      value.startsWith('map-draw'),
    )
    expect(draws.length).toBeGreaterThan(0)
    for (const { within } of draws) expect(within.join(' ')).toContain('.map:not(.is-settled)')
  })

  it('is dark only', () => {
    for (const [name, css] of Object.entries(sheets)) {
      expect(css, name).not.toMatch(/prefers-color-scheme|data-theme/)
    }
    expect(sheets['site.css']).toMatch(/:root\s*\{[^}]*color-scheme:\s*dark/)
  })

  it('gives the share cards the stylesheet’s own night colours', () => {
    const token = (name: string) =>
      new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`).exec(sheets['site.css'])?.[1]
    expect(CARD_PALETTE.lines).toEqual(
      Array.from({ length: LINE_COLOURS }, (_, k) => token(`line-${k + 1}`)),
    )
    expect(CARD_PALETTE.night).toBe(token('night'))
    expect(CARD_PALETTE.ground).toBe(token('ground'))
    expect(CARD_PALETTE.track).toBe(token('track'))
    expect(CARD_PALETTE.text).toBe(token('text'))
    expect(CARD_PALETTE.accent).toBe(token('accent'))
    expect(CARD_PALETTE.dim).toBe(token('text-dim'))
    expect(CARD_PALETTE.trainCore).toBe(token('train-core'))
    expect(cardLineColour(2)).toBe(token('line-2'))
    expect(cardLineColour(8)).toBe(token('line-2'))
  })

  it('defines the six line colours that lineColour names', () => {
    for (let k = 1; k <= LINE_COLOURS; k++)
      expect(sheets['site.css']).toMatch(new RegExp(`--line-${k}:\\s*#[0-9a-f]{6};`))
    expect(sheets['site.css']).not.toContain(`--line-${LINE_COLOURS + 1}:`)
  })
})
