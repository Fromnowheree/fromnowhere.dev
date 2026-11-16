import { NextRequest } from 'next/server'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GET as pickLanguage } from '@/app/(frontend)/pick-language/route'
import { LANGUAGE_PATH_HEADER } from '@/lib/locale'
import { getShortLinks } from '@/lib/payload'
import config from '@/payload.config'
import { seed } from '@/seed'

let payload: Payload

const PAGE_SLUGS = ['sl-draft-page', 'sl-free-page', 'sl-renamed']
const ALIASES = ['about', 'privacy', 'sl-draft-page', 'sl-free', 'sl-free-page']

const cleanUp = async () => {
  await payload.delete({ collection: 'short-links', where: { alias: { in: ALIASES } } })
  await payload.delete({ collection: 'pages', where: { slug: { in: PAGE_SLUGS } } })
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  await seed(payload)
  await cleanUp()
})

afterAll(cleanUp)

/** What the proxy hands the route for an address without a language. */
const arrive = (path: string) =>
  pickLanguage(
    new NextRequest('http://localhost:3000/pick-language', {
      headers: { [LANGUAGE_PATH_HEADER]: path },
    }),
  )

/** The messages a refused save gives the editor, or [] when it is saved. */
const refusal = async (
  save: () => Promise<{ id: number }>,
  collection: 'pages' | 'short-links',
) => {
  try {
    const doc = await save()
    await payload.delete({ collection, id: doc.id })
    return []
  } catch (error) {
    const errors = (error as { data?: { errors?: { message: string }[] } }).data?.errors ?? []
    return errors.map((e) => e.message)
  }
}

const shortLink = (alias: string) => () =>
  payload.create({ collection: 'short-links', data: { alias, url: 'https://example.com/sl' } })

const page =
  (slug: string, status: 'draft' | 'published' = 'published') =>
  () =>
    payload.create({
      collection: 'pages',
      draft: status === 'draft',
      data: { title: slug, slug, _status: status },
    })

describe('a short link and a page never share a word', () => {
  it('refuses a short link named like a published page', async () => {
    expect(await refusal(shortLink('about'), 'short-links')).toEqual([
      '"/about" is a page of this site. Choose another word.',
    ])
  })

  it('refuses a short link named like a draft page, which may be published later', async () => {
    await page('sl-draft-page', 'draft')()
    expect(await refusal(shortLink('sl-draft-page'), 'short-links')).toEqual([
      '"/sl-draft-page" is a page of this site. Choose another word.',
    ])
  })

  it('accepts a short link no page has taken', async () => {
    expect(await refusal(shortLink('sl-free'), 'short-links')).toEqual([])
  })

  it('refuses a page whose address is a short link', async () => {
    expect(await refusal(page('giogio'), 'pages')).toEqual([
      '"/giogio" is a short link. Choose another address, or remove the short link first.',
    ])
    // Written the way an editor might, the slug is checked as the word it becomes.
    expect(await refusal(page('GioGio '), 'pages')).toEqual([
      '"/giogio" is a short link. Choose another address, or remove the short link first.',
    ])
    expect(await refusal(page('sl-free-page'), 'pages')).toEqual([])
  })

  it('refuses a draft page whose address is a short link', async () => {
    expect(await refusal(page('gati', 'draft'), 'pages')).toEqual([
      '"/gati" is a short link. Choose another address, or remove the short link first.',
    ])
    expect(await refusal(page('sl-free-page', 'draft'), 'pages')).toEqual([])
  })

  it('refuses renaming a page to a short link, as a draft or published', async () => {
    const renamed = await page('sl-renamed')()
    const rename = (draft: boolean) => () =>
      payload.update({ collection: 'pages', id: renamed.id, draft, data: { slug: 'nmt' } })
    const message =
      '"/nmt" is a short link. Choose another address, or remove the short link first.'
    expect(await refusal(rename(true), 'pages')).toEqual([message])
    expect(await refusal(rename(false), 'pages')).toEqual([message])
  })

  it('still saves an existing page that no short link shares', async () => {
    const { docs } = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'about' } },
    })
    const about = docs[0]!
    const saved = await payload.update({
      collection: 'pages',
      id: about.id,
      data: { lead: about.lead },
    })
    expect(saved.slug).toBe('about')
  })

  it('still saves a page that a short link from before this rule shares', async () => {
    // Bypasses validation, like a row written before the rule existed. Only a new or changed
    // address is checked, so the page stays editable (and pick-language prefers it).
    await payload.db.create({
      collection: 'short-links',
      data: { alias: 'privacy', url: 'https://example.com/shadow' },
    })
    const { docs } = await payload.find({
      collection: 'pages',
      where: { slug: { equals: 'privacy' } },
    })
    const privacy = docs[0]!
    for (const draft of [true, false]) {
      const saved = await payload.update({
        collection: 'pages',
        id: privacy.id,
        draft,
        data: { title: privacy.title, slug: privacy.slug },
      })
      expect(saved.slug).toBe('privacy')
    }
  })
})

describe('an address without a language', () => {
  it('leads to the page when a short link was saved with its word anyway', async () => {
    // Bypasses validation, like a row written before the rule existed.
    await payload.db.create({
      collection: 'short-links',
      data: { alias: 'about', url: 'https://example.com/shadow' },
    })
    const response = await arrive('/about')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('/en/about')
  })

  it('still follows a short link no page shares', async () => {
    const response = await arrive('/giogio')
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://giogio.music')
  })
})

describe('the short links the home page’s ticker shows', () => {
  const ALIASES_HERE = ['sl-ticker-own', 'sl-ticker-draft']
  let draftId: number | undefined

  beforeAll(async () => {
    const draft = await payload.create({
      collection: 'projects',
      draft: true,
      data: {
        _status: 'draft',
        name: 'Ticker draft',
        slug: 'sl-ticker-draft',
        line: 97,
        status: 'running',
        kind: 'product',
        summary: 'Not ready to show.',
        addresses: [{ url: 'https://example.com/hidden' }],
      },
    })
    draftId = draft.id
    await payload.create({
      collection: 'short-links',
      data: { alias: 'sl-ticker-draft', project: draft.id },
    })
    await payload.create({
      collection: 'short-links',
      data: { alias: 'sl-ticker-own', url: 'https://example.com/own' },
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'short-links', where: { alias: { in: ALIASES_HERE } } })
    if (draftId) await payload.delete({ collection: 'projects', id: draftId })
  })

  it('says where each leads, in the line order of its project', async () => {
    const links = await getShortLinks()
    expect(links.filter((link) => ['ygo', 'giogio', 'nmt', 'gati'].includes(link.alias))).toEqual([
      { alias: 'ygo', href: 'https://yugioh.fromnowhere.dev', external: true },
      { alias: 'giogio', href: 'https://giogio.music', external: true },
      { alias: 'nmt', href: '/projects/nmt', external: false },
      { alias: 'gati', href: 'https://www.gati.hr', external: true },
    ])
  })

  it('leaves out a link to a project that is not published, and keeps one with its own address', async () => {
    const links = await getShortLinks()
    expect(links.map((link) => link.alias)).not.toContain('sl-ticker-draft')
    const own = links.findIndex((link) => link.alias === 'sl-ticker-own')
    expect(links[own]).toEqual({
      alias: 'sl-ticker-own',
      href: 'https://example.com/own',
      external: true,
    })
    expect(own).toBeGreaterThan(links.findIndex((link) => link.alias === 'gati'))
  })
})
