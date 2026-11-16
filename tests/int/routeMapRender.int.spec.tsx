import { createTranslator, NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import en from '../../messages/en.json'
import hr from '../../messages/hr.json'
import { RouteMap } from '@/components/site/RouteMap'
import type { Locale } from '@/i18n/locales'
import type { Project } from '@/payload-types'

/**
 * The route map as the server renders it (src/components/site/RouteMap.tsx), from fixture
 * projects shaped like the seed's, with no database: real links to each project's page, every
 * plate stating its own status in words, SVG hidden from assistive technology, no inline styles,
 * the rail with more than six lines, and nothing at all with none.
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
// Outside Next's router there is no current path; the map is rendered on the home page.
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
): Project =>
  ({
    id: line,
    name,
    slug,
    line,
    status,
    summary: `${name}.`,
    kind: 'product',
    addresses: urls.map((url, index) => ({ id: `${slug}-${index}`, url })),
    updatedAt: '2026-11-16T00:00:00.000Z',
    createdAt: '2026-11-16T00:00:00.000Z',
  }) as Project

/** The seeded four, in line order. */
const seeded = [
  project(1, 'locals', 'Locals', 'running', ['https://yugioh.fromnowhere.dev']),
  project(2, 'giogio', 'Giogio', 'running', [
    'https://giogio.music',
    'https://prod.giogio.music',
    'https://presstart.giogio.music',
  ]),
  project(3, 'nmt', 'Nowhere’s Medical Toolbox', 'building', []),
  project(4, 'gati', 'Gati', 'running', ['https://www.gati.hr']),
]

const items = (markup: string) =>
  [...markup.matchAll(/<li\b[^>]*>[\s\S]*?<\/li>/g)].map((m) => m[0])
const item = (markup: string, slug: string) =>
  items(markup).find((li) => li.includes(`data-line="${slug}"`))!

/** The text a screen reader reads for a piece of markup: without what is aria-hidden. */
const spoken = (markup: string) =>
  markup
    .replace(/<svg\b[\s\S]*?<\/svg>/g, '')
    .replace(/<span\b[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')

/** What a sighted visitor reads: without the visually hidden text. */
const visible = (markup: string) =>
  markup
    .replace(/<span class="fnw-sr">[^<]*<\/span>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&#x27;/g, "'")

describe('the route map', () => {
  it('is a navigation landmark named "Route map"', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    expect(markup).toMatch(/^<nav class="map" aria-label="Route map">/)
    expect(markup.match(/<nav\b/g)).toHaveLength(1)
    expect(markup).toContain('<ol class="map__lines" role="list">')
    expect(markup).toMatch(/<div class="map__origin" aria-hidden="true">/)
    expect(markup).toContain('>You are here<')
  })

  it('has one line per project, in line order, each linking to the project’s page here', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    const lines = items(markup)
    expect(lines).toHaveLength(seeded.length)
    lines.forEach((li, index) => {
      expect(li).toContain(`data-line="${seeded[index].slug}"`)
      expect([...li.matchAll(/href="([^"]*)"/g)].map((m) => m[1])).toEqual([
        `/en/projects/${seeded[index].slug}`,
      ])
    })
    const hrefs = [...markup.matchAll(/href="([^"]*)"/g)].map((m) => m[1])
    expect(hrefs.every((href) => href.startsWith('/en/projects/'))).toBe(true)
    expect(markup).not.toMatch(/href="(https?:)?\/\//)
  })

  it('dashes exactly the lines that are not running', async () => {
    const withoutAddress = project(5, 'quiet', 'Quiet', 'running', [])
    const projects = [...seeded, withoutAddress]
    const markup = html(await RouteMap({ projects, locale: 'en' }))
    expect(items(markup).map((li) => li.includes('map-line--dashed'))).toEqual([
      false,
      false,
      true,
      false,
      true,
    ])
    // Running with no address of its own: its line ends at its page here.
    expect(visible(item(markup, 'quiet'))).toContain(en.board.here)
  })

  it('says why a line is not running, with an icon and a word', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    const nmt = item(markup, 'nmt')
    expect(visible(nmt)).toContain('Building')
    expect(nmt).toMatch(/<span class="map-plate__status"><svg\b/)
    expect(spoken(nmt.slice(nmt.indexOf('<a')))).toBe(
      'Line 03, Nowhere’s Medical Toolbox, Building',
    )
  })

  it('shows the first address and counts the others, with a stop for each', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    const giogio = item(markup, 'giogio')
    expect(visible(giogio)).toContain('giogio.music · 2 more addresses')
    expect(giogio.match(/<circle\b/g)).toHaveLength(2)
    expect(spoken(giogio.slice(giogio.indexOf('<a')))).toBe(
      'Line 02, Giogio, giogio.music, 2 more addresses',
    )
    expect(item(markup, 'locals').match(/<circle\b/g)).toBeNull()
  })

  it('hides every SVG from assistive technology and keeps it out of the tab order', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    const svgs = [...markup.matchAll(/<svg\b[^>]*>/g)].map((m) => m[0])
    expect(svgs.length).toBeGreaterThan(seeded.length)
    for (const svg of svgs) {
      expect(svg).toContain('aria-hidden="true"')
      expect(svg).toContain('focusable="false"')
    }
  })

  it('has no inline style anywhere and no label on its links', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'en' }))
    expect(markup).not.toMatch(/\sstyle=/)
    expect(markup).not.toMatch(/<a\b[^>]*aria-label=/)
  })

  it('becomes the rail with more than six lines, drawn in CSS with no map SVG', async () => {
    const seven = [
      ...seeded,
      project(5, 'five', 'Five', 'running', ['https://five.example']),
      project(6, 'six', 'Six', 'running', ['https://six.example']),
      project(7, 'seven', 'Seven', 'running', ['https://seven.example']),
    ]
    const markup = html(await RouteMap({ projects: seven, locale: 'en' }))
    expect(markup).toMatch(/^<nav class="map map--rail"/)
    expect(items(markup)).toHaveLength(7)
    expect(markup).not.toMatch(/class="map-line__(fan|run)"/)
    expect(markup).not.toMatch(/<(path|line)\b/)
    // The only SVG left is the status icon on the one plate that is not running.
    expect(markup.match(/<svg\b/g)).toHaveLength(1)
    expect(item(markup, 'nmt')).toMatch(/<svg\b/)

    const running = seven.filter((p) => p.status === 'running')
    const allRunning = html(await RouteMap({ projects: running, locale: 'en' }))
    expect(allRunning).not.toContain('map--rail')
    const sevenRunning = [
      ...running,
      project(8, 'eight', 'Eight', 'running', ['https://e.example']),
    ]
    expect(sevenRunning).toHaveLength(7)
    const rail = html(await RouteMap({ projects: sevenRunning, locale: 'en' }))
    expect(rail).toContain('map--rail')
    expect(rail).not.toContain('<svg')
  })

  it('renders nothing without projects', async () => {
    expect(await RouteMap({ projects: [], locale: 'en' })).toBeNull()
  })

  it('speaks Croatian on the Croatian pages', async () => {
    const markup = html(await RouteMap({ projects: seeded, locale: 'hr' }), 'hr')
    expect(markup).toMatch(/^<nav class="map" aria-label="Karta linija">/)
    expect(markup).toContain('>Ovdje ste<')
    expect(visible(item(markup, 'giogio'))).toContain('giogio.music · još 2 adrese')
    expect(visible(item(markup, 'nmt'))).toContain(hr.status.building)
    expect(item(markup, 'giogio')).toContain('href="/hr/projects/giogio"')
    expect(spoken(item(markup, 'locals').slice(item(markup, 'locals').indexOf('<a')))).toBe(
      'Linija 01, Locals, yugioh.fromnowhere.dev',
    )
  })
})
