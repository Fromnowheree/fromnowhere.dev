import type { Payload } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { createTranslator, NextIntlClientProvider } from 'next-intl'
import type { ReactNode } from 'react'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import en from '../../messages/en.json'
import { useFreshDatabase } from '../helpers/freshDatabase'

/**
 * The site's chrome on a fresh install, before anything is filled in: nothing is invented for a
 * visitor, so no mail link to nobody, no link to an About or privacy page that does not exist,
 * and a home link that a screen reader can still name. Then, once there is something to show, it
 * shows. A database of its own, because the property is about a site with NO settings and no
 * content.
 */

// Outside Next there is no request to read the language from; the chrome is rendered in English.
vi.mock('next-intl/server', () => ({
  getTranslations: async ({ namespace }: { namespace?: string } = {}) =>
    createTranslator({
      locale: 'en',
      messages: en,
      namespace: namespace as never,
      timeZone: 'UTC',
    }),
}))
// Outside Next's router there is no current path; the chrome is rendered on the home page.
vi.mock('@/i18n/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/i18n/navigation')>()),
  usePathname: () => '/',
}))

let payload: Payload
let drop: (payload?: Payload) => Promise<void>
let Header: typeof import('@/components/site/Chrome').SiteHeader
let Footer: typeof import('@/components/site/Chrome').SiteFooter

beforeAll(async () => {
  ;({ drop } = await useFreshDatabase('empty_site'))
  process.env.PAYLOAD_SEED = 'false'
  const config = (await import('@/payload.config')).default
  const { getPayload } = await import('payload')
  payload = await getPayload({ config })
  ;({ SiteHeader: Header, SiteFooter: Footer } = await import('@/components/site/Chrome'))
}, 120_000)

afterAll(async () => {
  await drop?.(payload)
}, 60_000)

const html = (node: ReactNode) =>
  renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  )

/** The labels of the links to the home page that carry one, other than the language switch's
 * (named after its language): the logo link. */
const homeLinkLabels = (markup: string) =>
  [...markup.matchAll(/<a\b[^>]*\bhref="\/en"[^>]*>/g)].flatMap(([tag]) => {
    if (/\bhrefLang=/.test(tag)) return []
    const label = /\baria-label="([^"]*)"/.exec(tag)?.[1]
    return label === undefined ? [] : [label]
  })

describe('an empty site', () => {
  it('has a footer with no mail link and no privacy link', async () => {
    const markup = html(await Footer({ locale: 'en' }))
    expect(markup).not.toContain('mailto:')
    expect(markup).not.toContain('href="/en/privacy"')
    expect(markup).not.toMatch(/<a\b[^>]*>\s*<\/a>/)
  })

  it('has a header with no About link, and a home link a screen reader can name', async () => {
    const markup = html(await Header({ locale: 'en' }))
    expect(markup).not.toContain('href="/en/about"')
    expect(homeLinkLabels(markup)).toEqual([en.nav.home])
  })
})

describe('once the studio has an address and its pages are published', () => {
  beforeAll(async () => {
    await payload.updateGlobal({ slug: 'studio', data: { email: 'studio@example.com' } })
    for (const slug of ['about', 'privacy'])
      await payload.create({
        collection: 'pages',
        data: { title: slug, slug, _status: 'published' },
      })
  })

  it('shows them in the footer', async () => {
    const markup = html(await Footer({ locale: 'en' }))
    expect(markup).toContain('href="mailto:studio@example.com"')
    expect(markup).toContain(`>${en.footer.privacy}<`)
  })

  it('links the About page from the header', async () => {
    const markup = html(await Header({ locale: 'en' }))
    expect(markup).toContain(`>${en.nav.about}<`)
  })
})
