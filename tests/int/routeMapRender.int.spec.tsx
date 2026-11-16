import { createTranslator, NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import en from '../../messages/en.json'
import hr from '../../messages/hr.json'
import { RouteMap } from '@/components/site/RouteMap'
import { Board } from '@/components/site/Signs'
import type { Locale } from '@/i18n/locales'
import type { ShortLinkSign } from '@/lib/payload'
import type { Project } from '@/payload-types'

/**
 * The route map and the departures board as the server renders them (Night transit), from
 * fixture projects shaped like the seed's, with no database. The map: both layouts, finished,
 * hidden from assistive technology except one well-named link per line, each line in its colour.
 * The board: the accessible list, status as an icon, a word and a sub-label, the ticker of short
 * links, and no clock until the browser can tell the time.
 */

const messages = { en, hr } as const

// Outside Next there is no request to read the language from: the language passed in is the one
// the map is rendered in.
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale, namespace }: { locale: Locale; namespace?: string }) =>
    createTranslator({
      locale,
      messages: messages[locale],
      namespace: namespace as never,
      timeZone: 'UTC',
    }),
}))
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  usePathname: () => '/',
}))

const html = (node: ReactNode, locale: Locale = 'en') =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  )

const project = (
  line: number,
  slug: string,
  name: string,
  status: Project['status'],
  urls: string[],
  kind: Project['kind'] = 'product',
): Project =>
  ({
    id: line,
    name,
    slug,
    line,
    status,
    summary: `${name}, in one sentence.`,
    kind,
    addresses: urls.map((url, index) => ({ id: `${slug}-${index}`, url })),
    updatedAt: '2026-11-16T00:00:00.000Z',
    createdAt: '2026-11-16T00:00:00.000Z',
  }) as Project

/** The seeded four, in line order. */
const seeded = [
  project(1, 'locals', 'Locals', 'running', ['https://yugioh.fromnowhere.dev'], 'community'),
  project(
    2,
    'giogio',
    'Giogio',
    'running',
    ['https://giogio.music', 'https://prod.giogio.music', 'https://presstart.giogio.music'],
    'music',
  ),
  project(3, 'nmt', 'Nowhere’s Medical Toolbox', 'building', []),
  project(4, 'gati', 'Gati', 'running', ['https://www.gati.hr'], 'client'),
]

const shortLinks: ShortLinkSign[] = [
  { alias: 'ygo', href: 'https://yugioh.fromnowhere.dev', external: true },
  { alias: 'giogio', href: 'https://giogio.music', external: true },
  { alias: 'nmt', href: '/projects/nmt', external: false },
  { alias: 'gati', href: 'https://www.gati.hr', external: true },
]

const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr'])

/**
 * The text of some markup, as read by a screen reader (`spoken`: without anything aria-hidden) or
 * as seen (`visible`: without the visually hidden .fnw-sr text). A small tag walker: the markup is
 * React's, so always well formed.
 */
const textOf = (markup: string, skip: (tag: string) => boolean) => {
  let out = ''
  let hiddenDepth = 0
  const stack: boolean[] = []
  for (const part of markup.split(/(<[^>]+>)/)) {
    if (!part) continue
    // Every element boundary separates words, as a screen reader or a reader's eye does.
    if (part.startsWith('</')) {
      if (stack.pop()) hiddenDepth--
      out += ' '
    } else if (part.startsWith('<')) {
      const name = /^<([\w-]+)/.exec(part)?.[1] ?? ''
      out += ' '
      if (part.endsWith('/>') || VOID.has(name)) continue
      const hides = skip(part)
      stack.push(hides)
      if (hides) hiddenDepth++
    } else if (hiddenDepth === 0) out += part
  }
  return out
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .replace(/ ([,.])/g, '$1')
    .trim()
}
const spoken = (markup: string) =>
  textOf(markup, (tag) => /aria-hidden="true"/.test(tag) || /^<(svg|title)\b/.test(tag))
const visible = (markup: string) => textOf(markup, (tag) => /class="fnw-sr"/.test(tag))

/** Every element whose opening tag matches, with its content (balanced by tag name). */
const elements = (markup: string, open: RegExp): string[] => {
  const found: string[] = []
  for (const match of markup.matchAll(new RegExp(open.source, 'g'))) {
    const name = /^<([\w-]+)/.exec(match[0])![1]
    let depth = 0
    const re = new RegExp(`<${name}\\b[^>]*>|</${name}>`, 'g')
    re.lastIndex = match.index!
    for (let m = re.exec(markup); m; m = re.exec(markup)) {
      depth += m[0].startsWith('</') ? -1 : 1
      if (depth === 0) {
        found.push(markup.slice(match.index, m.index + m[0].length))
        break
      }
    }
  }
  return found
}

const hrefs = (markup: string) => [...markup.matchAll(/href="([^"]*)"/g)].map((m) => m[1])

describe('the route map', () => {
  it('is a navigation landmark named "Route map", drawn twice: wide, and tall for a phone', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    expect(markup).toMatch(/^<nav class="map" id="route-map" aria-label="Route map"/)
    expect(markup.match(/<nav\b/g)).toHaveLength(1)
    const svgs = [...markup.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0])
    expect(svgs).toHaveLength(2)
    expect(svgs[0]).toContain('map__svg--wide')
    expect(svgs[1]).toContain('map__svg--tall')
    for (const svg of svgs) {
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('focusable="false"')
    }
  })

  it('is finished as served: every line drawn, with its terminal and its trains in place', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    for (const svg of elements(markup, /<svg\b[^>]*>/)) {
      const lines = elements(svg, /<g class="line line--[a-z]+"[^>]*>/)
      expect(lines.map((g) => /data-line="([^"]+)"/.exec(g)![1])).toEqual(seeded.map((p) => p.slug))
      for (const g of lines) {
        expect(g).toMatch(/class="line__terminal"/)
        expect(g).toMatch(/class="line__hit"/)
      }
      // Running lines: a solid line with a lit core; trains, one per address, two at least.
      const giogio = lines[1]
      expect(giogio).toMatch(/class="line__main" d="M/)
      expect(giogio).not.toMatch(/class="line__main"[^>]*stroke-dasharray/)
      expect(giogio).toMatch(/class="line__core"/)
      expect(giogio.match(/class="train"/g)).toHaveLength(3)
      expect(giogio.match(/class="line__stop"/g)).toHaveLength(2)
      expect(lines[0].match(/class="train"/g)).toHaveLength(2)
      // Under construction: built half way, dashed beyond, work lights and a hazard at the
      // frontier, an open terminal, one train creeping up to the frontier.
      const nmt = lines[2]
      expect(nmt).toMatch(/class="line__main"[^>]*stroke-dasharray="[\d.]+ [\d.]+"/)
      expect(nmt).toMatch(/class="line__rest"[^>]*stroke-dasharray="0 [\d.]+ /)
      expect(nmt).toMatch(/class="line__hazard"/)
      expect(nmt.match(/class="line__light/g)).toHaveLength(3)
      expect(nmt).not.toMatch(/class="line__core"/)
      expect(nmt.match(/class="train"/g)).toHaveLength(1)
    }
  })

  it('colours each line, its terminal card, by its line number', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    for (const [index, p] of seeded.entries()) {
      const colour = `--c:var(--line-${index + 1})`
      const parts = [...markup.matchAll(new RegExp(`<[^>]*data-line="${p.slug}"[^>]*>`, 'g'))]
      expect(parts.length).toBeGreaterThanOrEqual(3) // the two drawings and the card
      for (const [tag] of parts.filter(([tag]) => /class="(line|term) /.test(tag)))
        expect(tag).toContain(colour)
    }
  })

  it('reads as one link per line, to the project’s page here, named by line, name and status', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    expect(hrefs(markup)).toEqual(seeded.map((p) => `/en/projects/${p.slug}`))
    const cards = elements(markup, /<div class="term [^"]*"[^>]*>/)
    expect(cards.map(spoken)).toEqual([
      'Line 01, Locals, Running',
      'Line 02, Giogio, Running',
      'Line 03, Nowhere’s Medical Toolbox, Building',
      'Line 04, Gati, Running',
    ])
    expect(spoken(markup)).toBe(cards.map(spoken).join(' '))
  })

  it('shows each terminal’s address, its stops, and why a line is not in service', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    const cards = elements(markup, /<div class="term [^"]*"[^>]*>/).map(visible)
    expect(cards[0]).toContain('Locals')
    expect(cards[0]).toContain('yugioh.fromnowhere.dev')
    expect(cards[1]).toContain('giogio.music +2 stops')
    expect(cards[2]).toContain(en.board.sub.building)
    expect(visible(markup)).toContain('prod.')
    expect(visible(markup)).toContain('presstart.')
    expect(visible(markup)).toContain(en.map.origin)
  })

  it('has no links out of the station: exits are on the board and the project pages', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    expect(markup).not.toMatch(/href="(https?:)?\/\//)
  })

  it('draws up to twelve lines, and nothing beyond, or with none', async () => {
    const twelve = Array.from({ length: 12 }, (_, i) =>
      project(i + 1, `p${i + 1}`, `P${i + 1}`, 'running', ['https://example.com']),
    )
    const markup = html(await RouteMap({ projects: twelve, locale: 'en' }))
    expect(markup).toContain('class="map map--dense"')
    expect(elements(markup, /<div class="term [^"]*"[^>]*>/)).toHaveLength(12)
    expect(markup).toContain('--c:var(--line-1)')
    expect(markup).toContain('--c:var(--line-6)')
    expect(
      await RouteMap({
        projects: [...twelve, project(13, 'p13', 'P13', 'running', [])],
        locale: 'en',
      }),
    ).toBeNull()
    expect(await RouteMap({ projects: [], locale: 'en' })).toBeNull()
  })

  it('speaks Croatian on the Croatian pages', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'hr' }), 'hr')
    expect(markup).toMatch(/aria-label="Karta linija"/)
    expect(visible(markup)).toContain('giogio.music +2 stanice')
    expect(visible(markup)).toContain(hr.map.origin)
    expect(hrefs(markup)).toContain('/hr/projects/giogio')
    expect(spoken(elements(markup, /<div class="term [^"]*"[^>]*>/)[2])).toBe(
      'Linija 03, Nowhere’s Medical Toolbox, U izradi',
    )
  })
})

describe('the departures board', () => {
  const board = async (locale: Locale = 'en', links = shortLinks) =>
    html(
      await Board({ projects: seeded, shortLinks: links, host: 'fromnowhere.dev', locale }),
      locale,
    )

  it('lists every project in line order, in its colour, each linking to its page', async () => {
    const markup = await board()
    const rows = elements(markup, /<li class="row"[^>]*>/)
    expect(rows.map((row) => /data-line="([^"]+)"/.exec(row)![1])).toEqual(
      seeded.map((p) => p.slug),
    )
    rows.forEach((row, i) => {
      expect(row).toContain(`--c:var(--line-${i + 1})`)
      expect(hrefs(row)[0]).toBe(`/en/projects/${seeded[i].slug}`)
    })
    expect(spoken(rows[0])).toMatch(/^Line 01 Locals /)
  })

  it('gives every address as an exit, and a line without one its page here', async () => {
    const rows = elements(await board(), /<li class="row"[^>]*>/)
    expect(hrefs(rows[1]).slice(1)).toEqual([
      'https://giogio.music',
      'https://prod.giogio.music',
      'https://presstart.giogio.music',
    ])
    expect(rows[1]).toMatch(/<a href="https:\/\/giogio.music" rel="noopener noreferrer">/)
    expect(hrefs(rows[2])).toEqual(['/en/projects/nmt', '/en/projects/nmt'])
    expect(visible(rows[2])).toContain('fromnowhere.dev/projects/nmt')
  })

  it('says each status with an icon, a word and a sub-label, never colour alone', async () => {
    const rows = elements(await board(), /<li class="row"[^>]*>/)
    expect(rows[0]).toMatch(/<span class="status status--running"><svg class="status__icon"/)
    expect(visible(rows[0])).toContain(`${en.status.running} ${en.board.sub.running}`)
    expect(rows[2]).toMatch(/<span class="status status--building"><svg class="status__icon"/)
    expect(visible(rows[2])).toContain(`${en.status.building} ${en.board.sub.building}`)
  })

  it('runs a ticker of the short links, hidden from assistive technology', async () => {
    const markup = await board()
    const [ticker] = elements(markup, /<div class="ticker"[^>]*>/)
    expect(ticker).toMatch(/^<div class="ticker" aria-hidden="true">/)
    const text = visible(ticker)
    expect(text).toContain('fromnowhere.dev/ygo → yugioh.fromnowhere.dev')
    expect(text).toContain('fromnowhere.dev/nmt → its page here')
    expect(text).toContain('fromnowhere.dev/gati → gati.hr')
    expect(text.indexOf('/ygo')).toBeLessThan(text.indexOf('/gati'))
    expect(elements(markup, /<span class="ticker__copy">/)).toHaveLength(2)
    expect(await board('en', [])).not.toContain('class="ticker"')
  })

  it('shows no clock until the browser knows the visitor’s time', async () => {
    const markup = await board()
    expect(markup).toMatch(/<div class="clock" hidden="">/)
  })

  it('is the board named "Departures", with the anchor the header’s Projects link names', async () => {
    const markup = await board()
    expect(markup).toContain(`<h2 class="board__title" id="projects">${en.board.title}</h2>`)
    const croatian = await board('hr')
    expect(croatian).toContain(`>${hr.board.title}</h2>`)
    expect(visible(croatian)).toContain('fromnowhere.dev/nmt → njegova stranica ovdje')
  })
})
