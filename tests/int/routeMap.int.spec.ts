import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { MAP, stopsFor, wideMap } from '@/lib/routeMap'

/**
 * The route map's geometry (src/lib/routeMap.ts) and its stylesheet (routemap.css), without a
 * browser or a database: the fan is drawn on the mark's grid (horizontal and 45° strokes only,
 * parallel lines exactly 7 units apart, every line starting on the gap circle around the point and
 * ending on its own row), and the CSS keeps the rules docs/phase-1.md sets for lighting and motion.
 */

type Point = { x: number; y: number }
type Segment = [Point, Point]

/** A fan path ("M x y H x L x y H x") as its segments. */
const segmentsOf = (d: string): Segment[] => {
  const tokens = d.trim().split(/\s+/)
  const segments: Segment[] = []
  let at: Point | null = null
  for (let index = 0; index < tokens.length;) {
    const command = tokens[index++]
    if (command === 'M') {
      at = { x: Number(tokens[index++]), y: Number(tokens[index++]) }
    } else if (command === 'H' && at) {
      const next: Point = { x: Number(tokens[index++]), y: at.y }
      segments.push([at, next])
      at = next
    } else if (command === 'L' && at) {
      const next: Point = { x: Number(tokens[index++]), y: Number(tokens[index++]) }
      segments.push([at, next])
      at = next
    } else {
      throw new Error(`Unexpected path command ${command} in "${d}"`)
    }
  }
  return segments
}

const length = ([a, b]: Segment) => Math.hypot(b.x - a.x, b.y - a.y)

const cross = (o: Point, a: Point, b: Point) =>
  (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

const onSegment = (p: Point, [a, b]: Segment) =>
  Math.min(a.x, b.x) - 1e-9 <= p.x &&
  p.x <= Math.max(a.x, b.x) + 1e-9 &&
  Math.min(a.y, b.y) - 1e-9 <= p.y &&
  p.y <= Math.max(a.y, b.y) + 1e-9

/** Whether two segments touch or cross (collinear overlaps included). */
const intersects = (s: Segment, t: Segment): boolean => {
  const d1 = cross(t[0], t[1], s[0])
  const d2 = cross(t[0], t[1], s[1])
  const d3 = cross(s[0], s[1], t[0])
  const d4 = cross(s[0], s[1], t[1])
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0)))
    return true
  return (
    (d1 === 0 && onSegment(s[0], t)) ||
    (d2 === 0 && onSegment(s[1], t)) ||
    (d3 === 0 && onSegment(t[0], s)) ||
    (d4 === 0 && onSegment(t[1], s))
  )
}

const counts = Array.from({ length: MAP.wideMax }, (_, index) => index + 1)

describe('wideMap', () => {
  it('draws one line per project, from one to six', () => {
    for (const n of counts) {
      const map = wideMap(n)!
      expect(map.lines, `n=${n}`).toHaveLength(n)
      expect(map.height).toBe(MAP.row * n)
      map.lines.forEach((line, i) =>
        expect(line.viewBox).toBe(`0 ${MAP.row * i} ${map.width} ${MAP.row}`),
      )
    }
  })

  it('has no map beyond six lines, or with none: the rail takes over', () => {
    expect(wideMap(0)).toBeNull()
    expect(wideMap(MAP.wideMax + 1)).toBeNull()
    expect(wideMap(7)).toBeNull()
  })

  it('draws every segment horizontal or at exactly 45°', () => {
    for (const n of counts)
      for (const line of wideMap(n)!.lines)
        for (const [a, b] of segmentsOf(line.d)) {
          const dx = Math.abs(b.x - a.x)
          const dy = Math.abs(b.y - a.y)
          expect(dy === 0 || Math.abs(dx - dy) <= 0.01, `${line.d}`).toBe(true)
        }
  })

  it('starts every line on the gap circle around the point', () => {
    const R = MAP.point / 2
    for (const n of counts)
      for (const line of wideMap(n)!.lines) {
        const [start] = segmentsOf(line.d)[0]
        const distance = Math.hypot(start.x + R, start.y - (MAP.row / 2) * n)
        expect(Math.abs(distance - (R + MAP.gap)), `n=${n} ${line.d}`).toBeLessThanOrEqual(0.01)
      }
  })

  it('ends every line at the fan’s right edge, on its own row’s centre', () => {
    for (const n of counts) {
      const map = wideMap(n)!
      map.lines.forEach((line, i) => {
        const segments = segmentsOf(line.d)
        const end = segments[segments.length - 1][1]
        expect(end).toEqual({ x: map.width, y: MAP.row * i + 32.5 })
      })
    }
  })

  it('never crosses two lines', () => {
    for (const n of counts) {
      const lines = wideMap(n)!.lines.map((line) => segmentsOf(line.d))
      for (let a = 0; a < lines.length; a++)
        for (let b = a + 1; b < lines.length; b++)
          for (const s of lines[a])
            for (const t of lines[b]) expect(intersects(s, t), `n=${n}: ${a} × ${b}`).toBe(false)
    }
  })

  it('keeps adjacent diagonals on the same side exactly 7 apart', () => {
    for (const n of counts) {
      // Each diagonal on the line x + y = K (rising) or x − y = K (falling), by side.
      const sides: Record<'up' | 'down', { i: number; K: number }[]> = { up: [], down: [] }
      wideMap(n)!.lines.forEach((line, i) => {
        const diagonal = segmentsOf(line.d).find(([a, b]) => a.y !== b.y)
        if (!diagonal) return
        const [a, b] = diagonal
        if (b.y < a.y) sides.up.push({ i, K: a.x + a.y })
        else sides.down.push({ i, K: a.x - a.y })
      })
      for (const side of Object.values(sides))
        for (let index = 1; index < side.length; index++) {
          expect(side[index].i - side[index - 1].i).toBe(1)
          const apart = Math.abs(side[index].K - side[index - 1].K) / Math.SQRT2
          expect(Math.abs(apart - MAP.spacing), `n=${n}`).toBeLessThanOrEqual(0.01)
        }
      expect(sides.up.length + sides.down.length).toBe(n % 2 === 1 ? n - 1 : n)
    }
  })

  it('never narrows the fan as lines are added', () => {
    const widths = counts.map((n) => wideMap(n)!.width)
    for (let index = 1; index < widths.length; index++)
      expect(widths[index]).toBeGreaterThanOrEqual(widths[index - 1])
    expect(wideMap(1)!.width).toBe(52)
    expect(wideMap(4)!.width).toBe(138)
    expect(wideMap(6)!.width).toBe(195)
  })

  it('carries the dash pattern from the fan across the join into the run', () => {
    const period = MAP.dash[0] + MAP.dash[1]
    for (const n of counts)
      for (const line of wideMap(n)!.lines) {
        const fanLength = segmentsOf(line.d).reduce((sum, segment) => sum + length(segment), 0)
        expect(line.runDashOffset).toBeGreaterThanOrEqual(0)
        expect(line.runDashOffset).toBeLessThan(period)
        const phase = (((fanLength - 1 - line.runDashOffset) % period) + period) % period
        // Every number on the map is rounded to 0.01.
        expect(Math.min(phase, period - phase), `n=${n} ${line.d}`).toBeLessThanOrEqual(0.05)
      }
  })

  it('rounds every number to 0.01', () => {
    for (const n of counts)
      for (const line of wideMap(n)!.lines) {
        for (const value of [
          ...line.d.split(/\s+/).filter((t) => /\d/.test(t)),
          line.runDashOffset,
        ])
          expect(Number(value)).toBe(Math.round(Number(value) * 100) / 100)
      }
  })
})

describe('stopsFor', () => {
  it('spreads one stop per further address, three at most', () => {
    expect(stopsFor(3)).toEqual([33.33, 66.67])
    expect(stopsFor(2)).toEqual([50])
    expect(stopsFor(1)).toEqual([])
    expect(stopsFor(0)).toEqual([])
    expect(stopsFor(9)).toHaveLength(MAP.stopsMax)
  })
})

describe('the map’s scale', () => {
  const tokens = readFileSync(path.resolve(__dirname, '../../src/styles/fnw/tokens.css'), 'utf8')
  const token = (name: string) => {
    const match = new RegExp(`${name}:\\s*([\\d.]+)px`).exec(tokens)
    if (!match) throw new Error(`No ${name} in tokens.css`)
    return Number(match[1])
  }

  it('is one row per --space-section and a point of --size-icon-xl', () => {
    expect(MAP.row).toBe(token('--space-section'))
    expect(MAP.point).toBe(token('--size-icon-xl'))
  })
})

describe('routemap.css', () => {
  const css = readFileSync(
    path.resolve(__dirname, '../../src/app/(frontend)/[locale]/routemap.css'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '')

  /** Every rule's selectors, at any depth (at-rules left out). */
  const selectors = [...css.matchAll(/([^{};]+)\{/g)]
    .map((match) => match[1].trim())
    .filter((prelude) => prelude && !prelude.startsWith('@') && !/^(from|to|\d+%)/.test(prelude))
    .flatMap((prelude) =>
      // Prettier wraps a long selector over lines: one space between its parts.
      prelude.split(/,(?![^(]*\))/).map((selector) => selector.replace(/\s+/g, ' ').trim()),
    )

  /** The argument of every `:has(` in a selector, by balanced parentheses. */
  const hasArguments = (selector: string): string[] => {
    const found: string[] = []
    for (let start = selector.indexOf(':has('); start !== -1;) {
      let depth = 0
      let end = start + ':has('.length - 1
      for (; end < selector.length; end++) {
        if (selector[end] === '(') depth++
        else if (selector[end] === ')' && --depth === 0) break
      }
      found.push(selector.slice(start + ':has('.length, end))
      start = selector.indexOf(':has(', end)
    }
    return found
  }

  const boardRules = selectors.filter((selector) => selector.includes('.board'))

  it('lets board row K light map line K, by hover and by keyboard, for every K up to six', () => {
    expect(boardRules).toContain(
      '.site-main:has(.board tbody tr:hover) .map:not(.map--rail) .map-line',
    )
    expect(boardRules).toContain(
      '.site-main:has(.board tbody tr a:focus-visible) .map:not(.map--rail) .map-line',
    )
    for (let k = 1; k <= MAP.wideMax; k++) {
      for (const row of [`tr:nth-child(${k}):hover`, `tr:nth-child(${k}) a:focus-visible`]) {
        expect(boardRules).toContain(
          `.site-main:has(.board tbody ${row}) .map:not(.map--rail) .map-line:nth-child(${k})`,
        )
        if (k >= 2)
          expect(boardRules).toContain(
            `.site-main:has(.board tbody ${row}) .map:not(.map--rail) .map-line:nth-child(-n + ${k - 1})`,
          )
      }
    }
    expect(boardRules.some((selector) => selector.includes(`(${MAP.wideMax + 1})`))).toBe(false)
  })

  it('scopes every board rule to the wide-capable map, never the rail of more than six', () => {
    expect(boardRules.length).toBeGreaterThan(0)
    for (const selector of boardRules) expect(selector).toContain('.map:not(.map--rail)')
  })

  it('never nests :has() (Chromium drops the whole rule) and never uses :focus-within', () => {
    expect(selectors.some((selector) => selector.includes(':has('))).toBe(true)
    for (const selector of selectors) {
      for (const argument of hasArguments(selector))
        expect(argument, selector).not.toContain(':has(')
      expect(selector).not.toContain(':focus-within')
    }
  })

  it('does not depend on the page box of the page transition', () => {
    expect(css).not.toContain('.site-page')
  })

  it('uses --duration-fast only for transitions, never in the draw', () => {
    const uses = [...css.matchAll(/--duration-fast/g)]
    expect(uses.length).toBeGreaterThan(0)
    for (const use of uses) {
      const before = css.slice(0, use.index)
      const declaration = before.slice(
        Math.max(before.lastIndexOf(';'), before.lastIndexOf('{')) + 1,
      )
      expect(declaration.trim()).toMatch(/^transition\s*:/)
    }
  })

  it('animates only under no-preference and on a page not yet played', () => {
    const animated = [...css.matchAll(/([^{};]+)\{[^{}]*\banimation(?:-name)?\s*:/g)].map((match) =>
      match[1].trim(),
    )
    expect(animated.length).toBeGreaterThan(0)
    for (const prelude of animated)
      for (const selector of prelude.split(','))
        expect(selector.trim()).toMatch(/^html:not\(\.fnw-calm\) /)
    const draw = css.slice(css.indexOf('@media (prefers-reduced-motion: no-preference)'))
    expect(draw).toContain('html:not(.fnw-calm) .map-line__run')
    expect(css).not.toMatch(/stroke-dashoffset/)
  })
})
