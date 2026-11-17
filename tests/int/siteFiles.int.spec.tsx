import { readFileSync } from 'node:fs'
import path from 'node:path'

import { NextIntlClientProvider } from 'next-intl'
import { getPayload, type Payload } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import en from '../../messages/en.json'
import hr from '../../messages/hr.json'
import SiteError from '@/app/(frontend)/[locale]/(site)/error'
import { GET as securityTxt } from '@/app/.well-known/security.txt/route'
import GlobalError from '@/app/global-error'
import manifest from '@/app/manifest'
import { JsonLd } from '@/components/JsonLd'
import { noteNode, projectNode, studioGraph } from '@/lib/structuredData'
import config from '@/payload.config'
import { seed } from '@/seed'

/**
 * The site's smaller files: the error pages, the structured data, the web manifest and its icons,
 * and security.txt. The feed and the pages' heads are checked in a browser (tests/e2e/seo).
 */

const messages = { en, hr } as const

describe('the error page', () => {
  for (const locale of ['en', 'hr'] as const) {
    it(`says what happened in ${locale}, with Try again and the way home`, () => {
      const html = renderToStaticMarkup(
        <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone="UTC">
          <SiteError error={new Error('secret detail')} retry={() => {}} />
        </NextIntlClientProvider>,
      )
      expect(html).toContain(`<h1>${messages[locale].error.title}</h1>`)
      expect(html).toContain(`>${messages[locale].error.retry}</button>`)
      expect(html).toContain(`href="/"`)
      expect(html).toContain('not-found--interrupted')
      // What went wrong stays on the server.
      expect(html).not.toContain('secret detail')
    })
  }

  it('has a last resort of its own document, in both languages', () => {
    const html = renderToStaticMarkup(<GlobalError error={new Error('x')} retry={() => {}} />)
    expect(html).toMatch(/^<html lang="en"/)
    expect(html).toContain('Service interrupted')
    expect(html).toContain('lang="hr"')
    expect(html).toContain('href="/"')
  })
})

describe('structured data', () => {
  it('cannot be closed early by text from the CMS', () => {
    const html = renderToStaticMarkup(
      <JsonLd data={{ name: '</script><script>alert(1)</script>' }} />,
    )
    expect(html).not.toContain('</script><script>')
    expect(html.match(/<\/script>/g)).toHaveLength(1)
    const json = JSON.parse(/>(.*)<\/script>$/s.exec(html)![1]!)
    expect(json.name).toBe('</script><script>alert(1)</script>')
    expect(json['@context']).toBe('https://schema.org')
  })

  it('leaves out what the CMS does not have', () => {
    const graph = studioGraph({ description: null, email: '', profiles: [], languages: ['en'] })
    const studio = graph['@graph'][0] as Record<string, unknown>
    expect(Object.keys(studio)).not.toContain('email')
    expect(Object.keys(studio)).not.toContain('sameAs')
    expect(Object.keys(studio)).not.toContain('description')
  })

  it('names a project’s own address, and its page here without one', () => {
    const base = { locale: 'en' as const, path: '/projects/x', name: 'X', summary: 'S', stack: [] }
    expect(projectNode({ ...base, address: 'https://x.example' }).url).toBe('https://x.example')
    expect(projectNode(base).url).toMatch(/\/en\/projects\/x$/)
  })

  it('dates a note, and points it at its project', () => {
    const node = noteNode({
      locale: 'hr',
      path: '/notes/n',
      title: 'T',
      summary: 'S',
      date: '2026-11-17T12:00:00.000Z',
      about: { name: 'Giogio', path: '/projects/giogio' },
    })
    expect(node['@type']).toBe('BlogPosting')
    expect(node.datePublished).toBe('2026-11-17T12:00:00.000Z')
    expect(node.url).toMatch(/\/hr\/notes\/n$/)
    expect(node.about).toMatchObject({ name: 'Giogio' })
  })
})

describe('the web manifest', () => {
  const pngSize = (file: string) => {
    const bytes = readFileSync(file)
    return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`
  }

  it('lists icons that exist, at the sizes it says', () => {
    const { icons = [] } = manifest()
    expect(icons.map((icon) => icon.purpose)).toEqual(['any', 'any', 'maskable'])
    for (const icon of icons)
      expect(pngSize(path.join('public', icon.src)), icon.src).toBe(icon.sizes)
    expect(pngSize('src/app/apple-icon.png')).toBe('180x180')
  })

  it('is dark like the site', () => {
    expect(manifest().background_color).toBe('#05060f')
    expect(manifest().theme_color).toBe('#05060f')
  })
})

describe('security.txt', () => {
  let payload: Payload
  let previous: string | null | undefined

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await seed(payload)
    previous = (await payload.findGlobal({ slug: 'studio' })).email
  })

  afterAll(async () => {
    await payload.updateGlobal({ slug: 'studio', data: { email: previous ?? null } })
  })

  it('names the studio’s address and expires within a year', async () => {
    await payload.updateGlobal({ slug: 'studio', data: { email: 'hello@fromnowhere.dev' } })
    const response = await securityTxt()
    expect(response.status).toBe(200)
    const text = await response.text()
    expect(text).toMatch(/^Contact: mailto:hello@fromnowhere\.dev$/m)
    const expires = new Date(/^Expires: (.+)$/m.exec(text)![1]!)
    const days = (expires.getTime() - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(30)
    expect(days).toBeLessThan(365)
    expect(text).toMatch(/^Canonical: .*\/\.well-known\/security\.txt$/m)
  })

  it('is not there without an address: a security.txt with no Contact is invalid', async () => {
    await payload.updateGlobal({ slug: 'studio', data: { email: null } })
    expect((await securityTxt()).status).toBe(404)
  })
})
